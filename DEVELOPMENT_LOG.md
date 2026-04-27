# Quartz Publisher — 개발 기록

> Obsidian 노트를 Quartz v4를 통해 GitHub Pages에 게시하는 전체 워크플로의 구축 및 자동화 개발 기록.
>
> 기간: 2026-04-26 ~ 2026-04-27
> 작성자: thelyver / sylver

---

## 🎯 프로젝트 개요

**목표:** Obsidian Vault의 선택된 폴더/파일을 Quartz v4 정적 사이트 생성기로 빌드하고, GitHub Pages에 무료로 호스팅. 옵시디언 안에서 모든 발행 작업을 완결.

**최종 산출물:**
1. Quartz v4 + GitHub Pages 자동 배포 파이프라인
2. 인터랙티브 셸 스크립트 (`manage.sh`, `deploy.sh`)
3. Obsidian 커스텀 플러그인 **Quartz Publisher** (BRAT 호환)

**최종 사이트:** https://thelyver.github.io/quartz-site/

---

## 🧭 작업 흐름 (단계별)

### Phase 1 — Quartz + GitHub Pages 인프라 구축

**STEP 0~10** (`antigravity-quartz-mission.md` 미션 브리프 기준)

| Step | 작업 | 결과 |
|------|------|------|
| 0 | 환경 확인 (`node`, `npm`, `git`, `gh`) | Node v22.16.0, gh 2.86.0 |
| 1 | GitHub CLI 인증 (`gh auth status`) | 계정 `thelyver` 인증 완료 |
| 2 | Quartz v4 설치 (`git clone` + `npm install`) | `~/quartz-site/` 생성 |
| 3 | `sync-obsidian.sh` 동기화 스크립트 작성 | Obsidian 폴더 → `content/` 복사 |
| 4 | 초기 콘텐츠 동기화 (TYS, 더데어 두 폴더) | 38개 .md 빌드됨 |
| 5 | `quartz.config.ts` 수정 (pageTitle, locale, baseUrl) | "Sylver Notes" / ko-KR |
| 6 | 로컬 빌드 검증 (`npx quartz build`) | `Parsed 38 / Emitted 140 files` |
| 7 | GitHub repo 생성 및 v4 브랜치 푸시 | `thelyver/quartz-site` |
| 8 | GitHub Actions `deploy.yml` 작성 | Pages 배포 워크플로 |
| 9 | 최종 빌드 & GitHub Pages 활성화 (`build_type: workflow`) | success |
| 10 | 배포 URL 확인 | https://thelyver.github.io/quartz-site/ |

**중간 이슈 & 해결:**
- `gh repo create` 시 origin 충돌 → `git remote set-url`로 교체
- push 시 `workflow scope` 부족 → `gh auth refresh -s workflow`로 권한 추가
- Pages API `gh-pages branch must exist` → `build_type=workflow` 옵션으로 해결

---

### Phase 2 — 인터랙티브 셸 도구

폴더 추가/제거 후 자동 git push 가능한 메뉴형 스크립트.

| 파일 | 역할 |
|------|------|
| `~/quartz-site/folders.conf` | 게시 대상 폴더 매핑 (`vault_rel\|content_name`) |
| `~/quartz-site/manage.sh` | 인터랙티브 메뉴 (추가/제거/배포) |
| `~/quartz-site/deploy.sh` | 원클릭 배포 (Shell Commands 플러그인용) |
| `~/quartz-site/sync-obsidian.sh` | Obsidian → Quartz content 동기화 (manage.sh가 자동 생성) |

**Obsidian 통합:** Shell Commands 플러그인 + `bash ~/quartz-site/deploy.sh` 매핑.

---

### Phase 3 — Obsidian 플러그인 v0.1.0 (MVP)

설계 결정:
- **단위:** 파일 + 폴더 모두 게시 가능 (폴더는 "개별 파일로 펼침" 옵션 제공)
- **배포:** 수동 버튼 ("🚀 지금 배포")
- **상태 관리:** `state.json`만 플러그인이 관리, 빌드/푸시는 셸 호출
- **BRAT 호환:** 첫 릴리스부터 별도 GitHub repo + Actions release 워크플로

**구조:**
```
~/obsidian-quartz-publisher/
├── manifest.json          # 플러그인 메타
├── package.json           # npm scripts (dev/build)
├── tsconfig.json
├── esbuild.config.mjs     # 번들러 설정
├── versions.json          # Obsidian 버전 호환
├── main.ts                # 플러그인 본체
├── styles.css             # 사이드바/탐색기 스타일
├── README.md
└── .github/workflows/release.yml  # 태그 push → 자동 release
```

**기능:**
- 우측 사이드바 ItemView (게시 항목 리스트, 배포 버튼, 이력)
- 파일 탐색기 우클릭 메뉴 (게시/해제, 폴더 일괄)
- 탐색기 항목 옆 🌐 아이콘 (CSS 클래스 주입)
- 커맨드 팔레트 명령 4개
- 설정 페이지 (Quartz 경로, 브랜치, 사이트 URL)

**배포 로직:**
1. `state.json` 의 published 배열을 읽어 `~/quartz-site/content/` 정리
2. 각 항목을 fs로 직접 복사 (셸 sync-obsidian.sh 우회)
3. `git add` → `commit` → `push origin HEAD:v4`
4. GitHub Actions가 자동 빌드 + Pages 배포

---

### Phase 4 — v0.2.0 개선

첫 실사용 후 발견된 4가지 이슈를 한 번에 해결.

| 이슈 | 해결책 |
|------|--------|
| `index.md`에 옛 위키링크 박혀있어 옛 콘텐츠처럼 보임 | **자동 생성**: 게시 항목을 폴더별로 그룹핑해 메인 페이지로 매번 새로 작성 |
| Mermaid 다이어그램이 코드블록으로만 표시 (원본에 ` ``` ` 만 있고 `mermaid` 태그 없음) | **자동 태깅**: sync 시 코드블록 본문이 `graph TD` 등으로 시작하면 ` ```mermaid ` 로 변환 (vault 원본은 무손상) |
| 단일 .md 파일 게시 시 첨부 이미지/PDF가 함께 안 옴 | **첨부 자동 복사**: Obsidian metadata cache로 embeds/links 추적해 함께 복사 |
| 사이드바 게시 항목에서 실제 웹 URL 모름 | **↗ 버튼 추가**: 클릭 시 슬러그 변환된 실제 URL을 새 탭으로 열기 |

추가:
- 설정 페이지에 위 3개 자동 동작을 토글로 on/off
- Quartz config에 `enableMermaid: true` 명시

---

## 🛠 기술 스택

| 영역 | 도구 |
|------|------|
| 정적 사이트 생성기 | Quartz v4.5.2 |
| 호스팅 | GitHub Pages (workflow build_type) |
| CI/CD | GitHub Actions |
| 옵시디언 플러그인 언어 | TypeScript (ES2020, CJS bundle) |
| 번들러 | esbuild |
| 플러그인 배포 | BRAT (Beta Reviewers Auto-update Tester) |
| 셸 통합 | bash + Node child_process |

---

## 📁 자산 위치

| 항목 | 절대 경로 / URL |
|------|----------------|
| Obsidian Vault | `/Users/dunet/Documents/SylverObsidian/` |
| Quartz 사이트 | `/Users/dunet/quartz-site/` |
| 플러그인 소스 (개발) | `/Users/dunet/Library/CloudStorage/GoogleDrive-sylver@byplot.com/내 드라이브/02.현재 프로젝트/400.AI/04_Resources/Obsidian_plugin/obsidian-quartz-publisher/` (Google Drive 동기화) |
| 플러그인 설치본 (Vault 내) | `/Users/dunet/Documents/SylverObsidian/.obsidian/plugins/quartz-publisher/` |
| 사이트 GitHub repo | https://github.com/thelyver/quartz-site |
| 플러그인 GitHub repo | https://github.com/thelyver/obsidian-quartz-publisher |
| 라이브 사이트 | https://thelyver.github.io/quartz-site/ |

---

## 🔁 일상 워크플로

### 노트 게시
1. Obsidian 파일 탐색기에서 파일/폴더 우클릭 → "🌐 웹에 게시"
2. 우측 사이드바 "Quartz Publisher" 패널에서 "🚀 지금 배포" 클릭
3. 2~3분 후 사이트 반영

### 게시 해제
- 사이드바 항목 옆 ✕ 클릭 또는 우클릭 → "게시 해제"

### 게시한 페이지 바로 열기
- 사이드바 항목 옆 ↗ 클릭

---

## 🚀 플러그인 배포 (개발자용)

### 작업 디렉토리 진입
플러그인 소스가 Google Drive 경로에 있으므로 셸 환경변수로 별칭을 두면 편리:
```bash
# ~/.zshrc 등에 추가
export QP_DEV="/Users/dunet/Library/CloudStorage/GoogleDrive-sylver@byplot.com/내 드라이브/02.현재 프로젝트/400.AI/04_Resources/Obsidian_plugin/obsidian-quartz-publisher"
alias qp='cd "$QP_DEV"'
```

### 새 버전 릴리스
```bash
cd "$QP_DEV"           # 또는 alias qp
# 1. manifest.json, package.json, versions.json의 version 업데이트
# 2. 코드 수정
npm run build          # 로컬 검증
git add -A && git commit -m "v0.X.Y: ..."
git tag 0.X.Y
git push origin main 0.X.Y
```
GitHub Actions가 자동으로 release를 생성하고 BRAT 사용자에게 업데이트 푸시.

### 로컬 vault에 즉시 적용
```bash
PLUGIN_DIR="/Users/dunet/Documents/SylverObsidian/.obsidian/plugins/quartz-publisher"
cp "$QP_DEV"/{main.js,manifest.json,styles.css} "$PLUGIN_DIR/"
# Obsidian에서 Cmd+R로 reload
```

---

## 🔗 GitHub과의 관계 (로컬 경로 이동 시 영향)

**결론: 완전히 무관합니다.** 로컬 폴더를 어디로 옮기든 GitHub 작업에 영향이 없습니다.

### 왜 무관한가
- Git은 로컬 폴더의 절대 경로를 추적하지 않음 — `.git/config` 의 `remote.origin.url` 만 보고 푸시/풀.
- 폴더를 `mv` 로 통째로 옮겨도 `.git/` 디렉토리가 함께 이동하므로 모든 history/branch/remote 설정 유지.
- BRAT 사용자는 GitHub Releases에서 `main.js`/`manifest.json`/`styles.css` 만 받아감 → 개발자의 로컬 경로와 무관.
- GitHub Actions (release 워크플로) 도 GitHub 서버 안에서만 돌아가므로 로컬 경로 영향 없음.

### 다른 기기에서 작업 시
새 기기에서는 단순히 다시 clone:
```bash
git clone https://github.com/thelyver/obsidian-quartz-publisher.git
cd obsidian-quartz-publisher
npm install
```
빌드 결과물(`main.js`)은 `.gitignore` 처리되어 있으므로 로컬에서 직접 빌드.

### 영향 받는 것 (수동 업데이트 필요)
- **문서/스크립트 안의 절대 경로 문자열** — 본 DEVELOPMENT_LOG, README, 셸 alias 등.
- **Obsidian vault 내 플러그인 설치본** — `.obsidian/plugins/quartz-publisher/` 의 위치는 vault 안이라 그대로지만, 로컬 빌드 산출물을 복사해 넣는 명령의 source 경로가 바뀜.

---

## ⚠️ Google Drive 운용 주의점

플러그인 소스를 Google Drive 동기화 폴더에 두면서 발생할 수 있는 이슈와 대응책.

### 1. 동기화-Git 충돌
빌드 직후 Drive가 `main.js`, `package-lock.json` 등을 클라우드로 업로드하는 동안 동시에 `git add` / `commit` / `push` 를 하면 파일 락 충돌이 드물게 발생.

**대응:** 빌드 → 5초 정도 기다린 뒤 git 작업. 작업 표시줄의 Google Drive 아이콘이 회전 중이면 멈출 때까지 대기.

### 2. node_modules 클라우드 용량 점유
`.gitignore` 는 git 에만 적용되며 Google Drive에는 무시되지 않음. `node_modules/` (수백 MB) 가 그대로 동기화되어 Drive 용량 + 첫 sync 시간을 잡아먹음.

**대응 옵션:**
- (A) 무시하고 두기 — 한 번 sync 끝나면 변경 시에만 증분 업로드되어 일상 부담 적음.
- (B) Google Drive 앱 설정에서 해당 폴더를 **"이 컴퓨터에서만"** 으로 지정해 클라우드 업로드 차단.
- (C) `node_modules/` 를 vault 외부 경로로 심볼릭 링크 (복잡, 비권장).
- 가장 간단한 권장: **(A) 또는 (B)**.

### 3. 동기화 지연으로 인한 stale 빌드
Drive sync가 늦어 다른 기기에서 옛 `main.js` 를 받게 되는 경우 → 다른 기기에서는 어차피 vault에 직접 복사하지 말고 BRAT으로 GitHub release를 받게 하는 게 안전.

**대응:** 다중 기기 사용 시 vault에 빌드 산출물 직접 복사는 한 기기에서만 하고, 다른 기기는 BRAT 자동 업데이트에 의존.

### 4. 한글 경로 + 공백 + `@` 처리
경로에 `내 드라이브` (한글+공백), `sylver@byplot.com` 등이 들어가서 셸에서 직접 사용 시 항상 따옴표 필수:
```bash
cd "/Users/.../내 드라이브/..."   # OK
cd /Users/.../내 드라이브/...     # 깨짐
```
`$QP_DEV` 환경변수를 alias로 두는 이유.

### 5. 파일명 충돌 / 이중 인코딩
macOS Drive 클라이언트가 가끔 NFD/NFC 한글 정규화 차이로 동기화 충돌 (`파일 (1).md` 같은 이름 생성) — 발견 즉시 수동 정리.

### 6. 권장 워크플로
- 항상 **이 기기 (개발 본진)** 에서만 빌드/release.
- 다른 기기에서 작업할 일 생기면 GitHub에서 fresh clone (Drive 경로 재사용 X).
- 오프라인 작업 후 sync 충돌 시 git diff/git pull 로 해결, Drive 자동 머지에 의존 X.

---

## 🔮 향후 개선 후보

- [ ] 게시 항목별 슬러그 미리보기 (한글 정규화 이슈 표시)
- [ ] 자동 배포 모드 (debounce 후 토글 변경 시 자동 push)
- [ ] 민감 키워드 감지 (private, secret 등 포함 시 경고)
- [ ] 깨진 wikilink 점검 (게시 폴더 외부 참조)
- [ ] 폴더 단위 게시 시 하위 항목 트리 뷰 표시
- [ ] index.md 템플릿 커스터마이징
- [ ] 다국어 지원 (영어 UI)
- [ ] 모바일 지원 검토 (현재 desktop only)

---

## 📚 참고 링크

- Quartz v4 공식 문서: https://quartz.jzhao.xyz/
- Obsidian 플러그인 개발 가이드: https://docs.obsidian.md/Plugins/
- BRAT 가이드: https://github.com/TfTHacker/obsidian42-brat

---

## 🏷 버전 이력

| 버전 | 날짜 | 주요 변경 |
|------|------|----------|
| 0.1.0 | 2026-04-26 | MVP 릴리스 (사이드바, 컨텍스트 메뉴, 배포 버튼, 탐색기 아이콘) |
| 0.2.0 | 2026-04-27 | index.md 자동 생성, Mermaid 자동 태깅, 첨부 자동 복사, URL ↗ 버튼 |
| 0.3.0 | 2026-04-27 | `featured: true` frontmatter 자동 인식 → 메인에 "⭐ 주요 노트" 섹션 |

---

*이 문서는 Claude Code 세션에서 페어 프로그래밍으로 작성됨.*
