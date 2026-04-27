# Quartz Publisher

Publish selected Obsidian notes to a [Quartz v4](https://quartz.jzhao.xyz/) site on GitHub Pages — straight from your vault, with one click.

## Features

- **Sidebar panel** — list of published items, deploy button, recent history
- **Right-click menu** — toggle publish for any file or folder
- **File explorer icons** — 🌐 marker on published items
- **One-click deploy** — sync selected items → git commit → push → Pages rebuild
- **Auto-generated index.md** — your homepage is always up to date
- **Featured notes** — frontmatter `featured: true` lifts a note to the top of the homepage
- **Embedded attachments** — images/PDFs referenced by published notes are auto-copied
- **Mermaid auto-tagging** — untagged ` ``` ` blocks starting with `graph TD` etc. become `mermaid` blocks at sync time (vault stays untouched)

## Prerequisites

You must have a working Quartz v4 site on your machine:

1. Install Quartz v4 — see [official docs](https://quartz.jzhao.xyz/)
2. Connect it to a GitHub repository
3. Enable GitHub Pages with `build_type: workflow` (Quartz includes a default deploy workflow)

If your site already builds and deploys via `git push`, you're ready.

## Installation

### Via BRAT (recommended while in beta)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Community Plugins
2. BRAT settings → **Add Beta Plugin** → enter `thelyver/obsidian-quartz-publisher`
3. Enable "Quartz Publisher" in Community Plugins

### Manual

Download `main.js`, `manifest.json`, `styles.css` from the latest [release](https://github.com/thelyver/obsidian-quartz-publisher/releases) and place them in `<vault>/.obsidian/plugins/quartz-publisher/`.

## Setup

Open Settings → Quartz Publisher and fill in:

| Field | Example |
|-------|---------|
| Quartz site path | `/Users/me/quartz-site` |
| Site URL | `https://username.github.io/quartz-site/` |
| Git branch | `v4` (Quartz default) |

## Usage

1. Right-click any file or folder in the file explorer → **🌐 웹에 게시 (Publish to web)**
2. Open the Quartz Publisher panel (sidebar)
3. Click **🚀 지금 배포 (Deploy now)**
4. Wait 2~3 minutes for GitHub Actions to rebuild the site

### Featured notes

Add to a note's frontmatter:
```yaml
---
featured: true
title: My Important Note
description: Why this matters
---
```
It will appear under **⭐ 주요 노트** at the top of the homepage.

### Folder vs file publishing

- **Publish a folder** → entire folder copied as a sub-tree (matching Quartz's URL structure)
- **Publish individual files** → each file copied with its referenced attachments
- **Right-click folder → "폴더 내 모든 파일 개별 게시"** → registers each .md file individually (lets you mix featured + regular within the same folder)

## Settings

Toggleable behaviors:
- **Mermaid 자동 태깅** — auto-add `mermaid` language tag to bare code blocks containing diagram keywords
- **첨부파일 자동 포함** — copy embedded images/PDFs/audio referenced by published notes
- **index.md 자동 생성** — regenerate homepage on every deploy

## Limitations

- Desktop only (uses Node.js fs and child_process)
- macOS / Linux paths only currently (no Windows path testing)
- Korean slugify quirks (e.g., `소믈` → `소물`) inherited from Quartz — preview URL with the ↗ button before sharing

## Development

```bash
git clone https://github.com/thelyver/obsidian-quartz-publisher
cd obsidian-quartz-publisher
npm install
npm run build
```

Copy `main.js` + `manifest.json` + `styles.css` into your vault's `.obsidian/plugins/quartz-publisher/` to test.

## License

MIT
