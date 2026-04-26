# Quartz Publisher

옵시디언에서 선택한 파일/폴더를 [Quartz v4](https://quartz.jzhao.xyz/)를 통해 GitHub Pages로 게시하는 플러그인.

## 기능 (MVP)

- 사이드바 패널: 게시 항목 리스트 + 사이트 URL + 최근 배포 시각 + 이력
- 파일 탐색기 우클릭 메뉴
  - 파일/폴더 단위 게시 토글
  - 폴더 내 모든 파일 개별 게시 / 전체 해제
- 파일 탐색기 아이콘 표시 (🌐)
- 원클릭 배포 (sync → git commit → push)
- "Quartz 폴더 열기" 버튼 (Finder)

## 사전 준비

`~/quartz-site` 가 다음을 만족해야 합니다:

- Quartz v4 설치됨 (`npm install` 완료)
- GitHub remote 설정됨 (`origin`)
- `.github/workflows/deploy.yml` 존재 (GitHub Pages 자동 배포)
- GitHub Pages 활성화 (`build_type: workflow`)

## 설치 (BRAT)

1. Obsidian → 커뮤니티 플러그인에서 **BRAT** 설치 및 활성화
2. BRAT 설정 → "Add Beta Plugin" → 이 저장소 URL 입력
3. 플러그인 목록에서 "Quartz Publisher" 활성화

## 설정

설정 → Quartz Publisher 에서:

- Quartz 사이트 경로 (기본: `/Users/dunet/quartz-site`)
- Git 브랜치 (기본: `v4`)
- 사이트 URL

## 사용법

1. 파일 탐색기에서 게시할 파일/폴더 우클릭 → "🌐 웹에 게시"
2. 사이드바에서 "🚀 지금 배포" 클릭
3. 2~3분 후 사이트에 반영

## 개발

```bash
npm install
npm run dev      # watch mode
npm run build    # production
```

## 라이선스

MIT
