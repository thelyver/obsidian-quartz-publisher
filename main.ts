import {
  App, Plugin, PluginSettingTab, Setting, ItemView, WorkspaceLeaf,
  Notice, TFile, TFolder, FileSystemAdapter,
} from "obsidian";
import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";

const VIEW_TYPE = "quartz-publisher-view";

interface QuartzPublisherSettings {
  quartzPath: string;
  branch: string;
  siteUrl: string;
  published: string[];
  lastDeployedAt: number | null;
  history: HistoryEntry[];
  autoMermaid: boolean;
  autoEmbeds: boolean;
  autoIndex: boolean;
}

interface HistoryEntry {
  ts: number;
  count: number;
  ok: boolean;
  message: string;
}

const DEFAULTS: QuartzPublisherSettings = {
  quartzPath: "",
  branch: "v4",
  siteUrl: "",
  published: [],
  lastDeployedAt: null,
  history: [],
  autoMermaid: true,
  autoEmbeds: true,
  autoIndex: true,
};

const MERMAID_KEYWORDS = /^\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4Context|C4Container|C4Component|sankey|xychart)/;

export default class QuartzPublisherPlugin extends Plugin {
  settings: QuartzPublisherSettings;
  decorateTimer: number | null = null;

  async onload() {
    await this.loadSettings();

    this.registerView(VIEW_TYPE, (leaf) => new PublisherView(leaf, this));
    this.addRibbonIcon("upload-cloud", "Quartz Publisher", () => this.activateView());

    this.addCommand({ id: "open-publisher", name: "게시 패널 열기", callback: () => this.activateView() });
    this.addCommand({ id: "deploy-now", name: "지금 배포", callback: () => this.deploy() });
    this.addCommand({
      id: "toggle-publish-current",
      name: "현재 파일 게시 토글",
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        if (!f) return false;
        if (!checking) this.togglePath(f.path);
        return true;
      },
    });
    this.addCommand({ id: "open-quartz-folder", name: "Quartz 폴더 열기 (Finder)", callback: () => this.openQuartzFolder() });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, abstractFile) => {
        const isFolder = abstractFile instanceof TFolder;
        const isPublished = this.settings.published.includes(abstractFile.path);

        menu.addItem((item) => {
          item
            .setTitle(isPublished ? "🌐 게시 해제" : "🌐 웹에 게시")
            .setIcon("upload-cloud")
            .onClick(() => this.togglePath(abstractFile.path));
        });

        if (isFolder) {
          menu.addItem((item) => {
            item
              .setTitle("🌐 폴더 내 모든 파일 개별 게시")
              .setIcon("files")
              .onClick(() => this.publishAllInFolder(abstractFile as TFolder));
          });
          menu.addItem((item) => {
            item
              .setTitle("🌐 폴더 내 모두 해제")
              .setIcon("x")
              .onClick(() => this.unpublishAllInFolder(abstractFile as TFolder));
          });
        }
      })
    );

    this.registerEvent(this.app.workspace.on("layout-change", () => this.scheduleDecorate()));
    this.registerEvent(this.app.vault.on("create", () => this.scheduleDecorate()));
    this.registerEvent(this.app.vault.on("rename", () => this.scheduleDecorate()));
    this.registerEvent(this.app.vault.on("delete", () => this.scheduleDecorate()));
    this.app.workspace.onLayoutReady(() => this.scheduleDecorate());

    this.addSettingTab(new SettingsTab(this.app, this));
  }

  onunload() { this.clearDecorations(); }

  async loadSettings() { this.settings = Object.assign({}, DEFAULTS, await this.loadData()); }
  async saveSettings() { await this.saveData(this.settings); this.scheduleDecorate(); this.refreshView(); }

  async togglePath(p: string) {
    if (this.settings.published.includes(p)) {
      this.settings.published = this.settings.published.filter((x) => x !== p);
      new Notice(`해제: ${p}`);
    } else {
      this.settings.published.push(p);
      new Notice(`게시 추가: ${p}`);
    }
    await this.saveSettings();
  }

  async publishAllInFolder(folder: TFolder) {
    const files: string[] = [];
    const collect = (f: TFolder) => {
      for (const child of f.children) {
        if (child instanceof TFile) files.push(child.path);
        else if (child instanceof TFolder) collect(child);
      }
    };
    collect(folder);
    let added = 0;
    for (const f of files) {
      if (!this.settings.published.includes(f)) {
        this.settings.published.push(f);
        added++;
      }
    }
    new Notice(`${added}개 파일 게시 추가됨`);
    await this.saveSettings();
  }

  async unpublishAllInFolder(folder: TFolder) {
    const prefix = folder.path === "/" ? "" : folder.path + "/";
    const before = this.settings.published.length;
    this.settings.published = this.settings.published.filter((p) => p !== folder.path && !p.startsWith(prefix));
    new Notice(`${before - this.settings.published.length}개 항목 해제`);
    await this.saveSettings();
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      const right = workspace.getRightLeaf(false);
      if (!right) return;
      leaf = right;
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  refreshView() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach((leaf) => {
      const v = leaf.view as PublisherView;
      if (v && v.render) v.render();
    });
  }

  scheduleDecorate() {
    if (this.decorateTimer) window.clearTimeout(this.decorateTimer);
    this.decorateTimer = window.setTimeout(() => this.refreshDecorations(), 100);
  }

  refreshDecorations() {
    this.clearDecorations();
    const explorers = this.app.workspace.getLeavesOfType("file-explorer");
    if (!explorers.length) return;
    const root = (explorers[0].view as any).containerEl as HTMLElement;
    if (!root) return;
    for (const p of this.settings.published) {
      const items = root.querySelectorAll(`[data-path="${cssEscape(p)}"]`);
      items.forEach((el) => el.classList.add("quartz-published"));
    }
  }

  clearDecorations() {
    document.querySelectorAll(".quartz-published").forEach((el) => el.classList.remove("quartz-published"));
  }

  getVaultBasePath(): string {
    const a = this.app.vault.adapter;
    if (a instanceof FileSystemAdapter) return a.getBasePath();
    throw new Error("Desktop only");
  }

  openQuartzFolder() {
    execFile("open", [this.settings.quartzPath], (err) => {
      if (err) new Notice(`폴더 열기 실패: ${err.message}`);
    });
  }

  buildUrl(p: string): string {
    const slug = p.replace(/\.md$/i, "").replace(/ /g, "-");
    const base = this.settings.siteUrl.replace(/\/$/, "");
    const encoded = slug.split("/").map(encodeURIComponent).join("/");
    return `${base}/${encoded}`;
  }

  async syncContent(): Promise<number> {
    const contentDir = path.join(this.settings.quartzPath, "content");
    if (!fs.existsSync(contentDir)) {
      throw new Error(`content 폴더 없음: ${contentDir}`);
    }

    for (const entry of fs.readdirSync(contentDir)) {
      if (entry === ".gitkeep") continue;
      fs.rmSync(path.join(contentDir, entry), { recursive: true, force: true });
    }

    const vaultBase = this.getVaultBasePath();
    const copiedAttachments = new Set<string>();
    let copied = 0;

    for (const relPath of this.settings.published) {
      const src = path.join(vaultBase, relPath);
      const dst = path.join(contentDir, relPath);
      if (!fs.existsSync(src)) continue;

      fs.mkdirSync(path.dirname(dst), { recursive: true });
      const stat = fs.statSync(src);

      if (stat.isDirectory()) {
        this.copyDirRecursive(src, dst);
      } else {
        this.copyFileTransformed(src, dst);
        if (this.settings.autoEmbeds && relPath.toLowerCase().endsWith(".md")) {
          await this.copyEmbedsForFile(relPath, vaultBase, contentDir, copiedAttachments);
        }
      }
      copied++;
    }

    if (this.settings.autoIndex) {
      this.writeIndexMd(contentDir);
    }

    return copied;
  }

  copyFileTransformed(src: string, dst: string) {
    if (this.settings.autoMermaid && src.toLowerCase().endsWith(".md")) {
      const content = fs.readFileSync(src, "utf-8");
      const transformed = autoTagMermaid(content);
      fs.writeFileSync(dst, transformed, "utf-8");
    } else {
      fs.copyFileSync(src, dst);
    }
  }

  copyDirRecursive(src: string, dst: string) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      const s = path.join(src, entry);
      const d = path.join(dst, entry);
      const stat = fs.statSync(s);
      if (stat.isDirectory()) this.copyDirRecursive(s, d);
      else this.copyFileTransformed(s, d);
    }
  }

  async copyEmbedsForFile(vaultRel: string, vaultBase: string, contentDir: string, copied: Set<string>) {
    const file = this.app.vault.getAbstractFileByPath(vaultRel);
    if (!(file instanceof TFile)) return;
    const cache = this.app.metadataCache.getFileCache(file);
    const refs: string[] = [];
    if (cache?.embeds) refs.push(...cache.embeds.map((e) => e.link));
    if (cache?.links) refs.push(...cache.links.map((l) => l.link));

    for (const ref of refs) {
      const cleanRef = ref.split("#")[0].split("|")[0].trim();
      if (!cleanRef) continue;
      const resolved = this.app.metadataCache.getFirstLinkpathDest(cleanRef, vaultRel);
      if (!resolved) continue;
      if (copied.has(resolved.path)) continue;
      if (this.settings.published.includes(resolved.path)) continue;

      const src = path.join(vaultBase, resolved.path);
      const dst = path.join(contentDir, resolved.path);
      if (!fs.existsSync(src)) continue;

      fs.mkdirSync(path.dirname(dst), { recursive: true });
      this.copyFileTransformed(src, dst);
      copied.add(resolved.path);
    }
  }

  writeIndexMd(contentDir: string) {
    const grouped: Record<string, string[]> = {};
    const folders: string[] = [];
    const featured: { path: string; title: string; description?: string }[] = [];

    const collectFeatured = (filePath: string) => {
      const af = this.app.vault.getAbstractFileByPath(filePath);
      if (!(af instanceof TFile)) return;
      const cache = this.app.metadataCache.getFileCache(af);
      const fm = cache?.frontmatter;
      if (fm && fm.featured === true) {
        featured.push({
          path: filePath,
          title: fm.title || path.basename(filePath, ".md"),
          description: fm.description,
        });
      }
    };

    for (const p of this.settings.published) {
      const af = this.app.vault.getAbstractFileByPath(p);
      if (af instanceof TFolder) {
        folders.push(p);
        for (const child of getAllMarkdownFilesInFolder(af)) {
          collectFeatured(child.path);
        }
      } else if (p.toLowerCase().endsWith(".md")) {
        const top = p.split("/")[0] || "기타";
        if (!grouped[top]) grouped[top] = [];
        grouped[top].push(p);
        collectFeatured(p);
      }
    }

    let md = `---\ntitle: Sylver Notes\n---\n\n# Sylver Notes\n\n`;

    if (this.settings.published.length === 0) {
      md += `현재 게시된 항목이 없습니다.\n`;
    } else {
      md += `총 **${this.settings.published.length}개** 항목 게시됨.\n\n`;

      if (featured.length > 0) {
        md += `## ⭐ 주요 노트\n\n`;
        for (const f of featured) {
          const noExt = f.path.replace(/\.md$/i, "");
          if (f.description) {
            md += `- [[${noExt}|${f.title}]] — ${f.description}\n`;
          } else {
            md += `- [[${noExt}|${f.title}]]\n`;
          }
        }
        md += `\n`;
      }

      md += `## 📋 게시 현황\n\n`;

      if (folders.length > 0) {
        md += `### 📂 게시 폴더\n\n`;
        for (const f of folders.sort()) {
          const display = path.basename(f);
          md += `- [${display}](${encodeURI(f)}/)\n`;
        }
        md += `\n`;
      }

      const sortedTops = Object.keys(grouped).sort();
      for (const top of sortedTops) {
        md += `### 📁 ${top}\n\n`;
        for (const p of grouped[top].sort()) {
          const noExt = p.replace(/\.md$/i, "");
          const displayName = path.basename(noExt);
          md += `- [[${noExt}|${displayName}]]\n`;
        }
        md += `\n`;
      }
    }

    fs.writeFileSync(path.join(contentDir, "index.md"), md, "utf-8");
  }

  async deploy() {
    if (!this.settings.quartzPath) {
      new Notice("⚠️ 먼저 설정에서 'Quartz 사이트 경로'를 지정하세요.", 6000);
      return;
    }
    if (!fs.existsSync(this.settings.quartzPath)) {
      new Notice(`⚠️ 경로를 찾을 수 없습니다: ${this.settings.quartzPath}`, 6000);
      return;
    }
    if (this.settings.published.length === 0) {
      new Notice("게시할 항목이 없습니다.");
      return;
    }

    const notice = new Notice("🔄 동기화 중...", 0);
    let copied = 0;

    try {
      copied = await this.syncContent();
      notice.setMessage(`📦 ${copied}개 동기화 완료. Git 커밋/푸시 중...`);

      const cwd = this.settings.quartzPath;
      await runShell("git", ["add", "-A"], cwd);

      const hasChanges = await runShell("git", ["diff", "--cached", "--quiet"], cwd)
        .then(() => false)
        .catch(() => true);

      if (!hasChanges) {
        notice.hide();
        new Notice("변경 사항 없음.");
        return;
      }

      const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
      await runShell("git", ["commit", "-m", `Update notes ${ts}`], cwd);
      await runShell("git", ["push", "origin", `HEAD:${this.settings.branch}`], cwd);

      this.settings.lastDeployedAt = Date.now();
      this.settings.history.unshift({ ts: Date.now(), count: copied, ok: true, message: `${copied}개 항목 배포` });
      this.settings.history = this.settings.history.slice(0, 20);
      await this.saveSettings();

      notice.hide();
      new Notice("✅ 배포 완료! 2~3분 후 사이트에 반영됩니다.", 6000);
    } catch (e: any) {
      this.settings.history.unshift({ ts: Date.now(), count: copied, ok: false, message: e.message || String(e) });
      this.settings.history = this.settings.history.slice(0, 20);
      await this.saveSettings();
      notice.hide();
      new Notice(`❌ 배포 실패: ${e.message || e}`, 8000);
      console.error("[Quartz Publisher]", e);
    }
  }
}

class PublisherView extends ItemView {
  plugin: QuartzPublisherPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: QuartzPublisherPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Quartz Publisher"; }
  getIcon() { return "upload-cloud"; }

  async onOpen() { this.render(); }

  render() {
    const c = this.containerEl.children[1] as HTMLElement;
    c.empty();
    c.addClass("quartz-publisher-view");

    c.createEl("h3", { text: "🌐 Quartz Publisher" });

    if (!this.plugin.settings.quartzPath) {
      const setup = c.createEl("div", { cls: "qp-setup" });
      setup.createEl("div", { text: "👋 첫 사용 안내", cls: "qp-setup-title" });
      setup.createEl("p", {
        text: "이 플러그인을 사용하려면 먼저 로컬에 Quartz v4 사이트가 준비되어 있어야 합니다.",
      });
      const ol = setup.createEl("ol");
      ol.createEl("li", { text: "Quartz v4 사이트 설치 및 GitHub 연결" });
      ol.createEl("li", { text: "아래 '설정 열기' 버튼 → Quartz 사이트 경로 / 사이트 URL 입력" });
      ol.createEl("li", { text: "파일 탐색기에서 게시할 노트 우클릭 → 🌐 웹에 게시" });
      const setupBtn = setup.createEl("button", { text: "⚙️ 설정 열기", cls: "qp-deploy" });
      setupBtn.onclick = () => {
        (this.app as any).setting.open();
        (this.app as any).setting.openTabById("quartz-publisher");
      };
      const docsBtn = setup.createEl("a", {
        text: "📖 README 보기",
        href: "https://github.com/thelyver/obsidian-quartz-publisher",
        cls: "qp-secondary",
      });
      docsBtn.target = "_blank";
      return;
    }

    const urlSec = c.createEl("div", { cls: "qp-section" });
    urlSec.createEl("div", { text: "사이트 URL", cls: "qp-label" });
    if (this.plugin.settings.siteUrl) {
      urlSec.createEl("a", {
        text: this.plugin.settings.siteUrl,
        href: this.plugin.settings.siteUrl,
        cls: "qp-link",
      });
    } else {
      urlSec.createEl("div", { text: "(설정에서 입력)", cls: "qp-empty" });
    }

    if (this.plugin.settings.lastDeployedAt) {
      const dt = new Date(this.plugin.settings.lastDeployedAt);
      c.createEl("div", { text: `최근 배포: ${dt.toLocaleString()}`, cls: "qp-meta" });
    }

    const list = c.createEl("div", { cls: "qp-section" });
    list.createEl("h4", { text: `게시 항목 (${this.plugin.settings.published.length})` });

    if (this.plugin.settings.published.length === 0) {
      list.createEl("div", {
        text: '없음. 파일 탐색기에서 우클릭 → "🌐 웹에 게시"',
        cls: "qp-empty",
      });
    } else {
      const ul = list.createEl("ul", { cls: "qp-list" });
      for (const p of this.plugin.settings.published) {
        const li = ul.createEl("li");
        const af = this.app.vault.getAbstractFileByPath(p);
        const isFolder = af instanceof TFolder;
        li.createEl("span", { text: isFolder ? "📁" : "📄", cls: "qp-icon" });
        li.createEl("span", { text: p, cls: "qp-path" });

        const linkBtn = li.createEl("a", { text: "↗", cls: "qp-open", attr: { title: "웹에서 열기" } });
        linkBtn.href = this.plugin.buildUrl(p);
        linkBtn.target = "_blank";

        const removeBtn = li.createEl("button", { text: "✕", cls: "qp-remove", attr: { title: "게시 해제" } });
        removeBtn.onclick = () => this.plugin.togglePath(p);
      }
    }

    const deployBtn = c.createEl("button", { text: "🚀 지금 배포", cls: "qp-deploy" });
    deployBtn.onclick = () => this.plugin.deploy();

    const folderBtn = c.createEl("button", { text: "📁 Quartz 폴더 열기", cls: "qp-secondary" });
    folderBtn.onclick = () => this.plugin.openQuartzFolder();

    if (this.plugin.settings.history.length > 0) {
      c.createEl("h4", { text: "최근 이력" });
      const hist = c.createEl("ul", { cls: "qp-list" });
      for (const h of this.plugin.settings.history.slice(0, 5)) {
        const li = hist.createEl("li");
        const dt = new Date(h.ts);
        const icon = h.ok ? "✅" : "❌";
        li.createEl("span", { text: icon, cls: "qp-icon" });
        li.createEl("span", { text: `${dt.toLocaleString()} · ${h.message}`, cls: "qp-path" });
      }
    }
  }
}

class SettingsTab extends PluginSettingTab {
  plugin: QuartzPublisherPlugin;
  constructor(app: App, plugin: QuartzPublisherPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Quartz Publisher" });

    const intro = containerEl.createEl("div", { cls: "qp-settings-intro" });
    intro.createEl("p", {
      text: "옵시디언 노트를 Quartz v4를 통해 GitHub Pages에 게시하는 플러그인입니다.",
    });
    intro.createEl("p", {
      text: "사전 준비: 로컬에 Quartz v4 사이트가 설치되어 있고, GitHub remote 가 연결되어 있어야 합니다.",
    });
    const link = intro.createEl("a", {
      text: "📖 셋업 가이드 (GitHub README)",
      href: "https://github.com/thelyver/obsidian-quartz-publisher",
    });
    link.target = "_blank";

    containerEl.createEl("h3", { text: "필수 설정" });

    new Setting(containerEl)
      .setName("Quartz 사이트 경로")
      .setDesc("로컬에 설치된 quartz-site 폴더의 절대 경로 (예: /Users/me/quartz-site)")
      .addText((t) =>
        t.setPlaceholder("/path/to/quartz-site")
          .setValue(this.plugin.settings.quartzPath)
          .onChange(async (v) => {
            this.plugin.settings.quartzPath = v.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("사이트 URL")
      .setDesc("배포된 GitHub Pages URL (예: https://username.github.io/quartz-site/)")
      .addText((t) =>
        t.setPlaceholder("https://username.github.io/repo/")
          .setValue(this.plugin.settings.siteUrl)
          .onChange(async (v) => {
            this.plugin.settings.siteUrl = v.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Git 브랜치")
      .setDesc("배포 대상 브랜치 (Quartz 기본: v4)")
      .addText((t) =>
        t.setValue(this.plugin.settings.branch).onChange(async (v) => {
          this.plugin.settings.branch = v.trim() || "v4";
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl("h3", { text: "동기화 옵션" });

    new Setting(containerEl)
      .setName("Mermaid 자동 태깅")
      .setDesc("코드 블록이 graph/flowchart/sequenceDiagram 등으로 시작하면 자동으로 ```mermaid 태그 추가")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.autoMermaid).onChange(async (v) => {
          this.plugin.settings.autoMermaid = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("첨부파일 자동 포함")
      .setDesc("게시한 파일이 참조하는 이미지/PDF 등 자동으로 함께 복사")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.autoEmbeds).onChange(async (v) => {
          this.plugin.settings.autoEmbeds = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("index.md 자동 생성")
      .setDesc("게시 항목 목록을 메인 페이지로 자동 생성")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.autoIndex).onChange(async (v) => {
          this.plugin.settings.autoIndex = v;
          await this.plugin.saveSettings();
        })
      );
  }
}

function getAllMarkdownFilesInFolder(folder: TFolder): TFile[] {
  const files: TFile[] = [];
  for (const child of folder.children) {
    if (child instanceof TFile && child.extension === "md") {
      files.push(child);
    } else if (child instanceof TFolder) {
      files.push(...getAllMarkdownFilesInFolder(child));
    }
  }
  return files;
}

function autoTagMermaid(content: string): string {
  return content.replace(/```(\w*)\r?\n([\s\S]*?)```/g, (match, lang, body) => {
    if (lang) return match;
    if (MERMAID_KEYWORDS.test(body)) {
      return "```mermaid\n" + body + "```";
    }
    return match;
  });
}

function runShell(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr?.toString() || err.message));
      else resolve(stdout?.toString() || "");
    });
  });
}

function cssEscape(s: string): string {
  return s.replace(/["\\]/g, "\\$&");
}
