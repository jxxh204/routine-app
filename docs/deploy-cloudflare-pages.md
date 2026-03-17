# Cloudflare Pages + GitHub Actions 배포 가이드

목표: Vercel 일일 배포 한도 이슈를 피하고, GitHub Actions로 웹 자동배포.

## 1) Cloudflare 준비
1. Cloudflare Pages 프로젝트 생성
2. Project name 확인 (예: `routine-web`)
3. API Token 생성
   - 권한: Pages Write, Account Read
4. Account ID 확인

## 2) GitHub 설정
Repository > Settings > Secrets and variables > Actions

### Secrets
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### Variables
- `CF_PAGES_PROJECT` (Cloudflare Pages project name)

## 3) 워크플로 개요
파일: `.github/workflows/web-cloudflare-pages.yml`

- PR 시: test/lint/build 후 preview 배포
- 태그 푸시(`vYYYY.MM.DD-N`) 시: production 배포
- `production` environment 보호 규칙으로 승인 게이트 가능

## 4) 태그 기반 프로덕션 배포
```bash
git checkout main
git pull --ff-only origin main
git tag -a v2026.03.17-1 -m "release: summary"
git push origin v2026.03.17-1
```

## 5) 브랜치/릴리즈 정책
- `docs/release-policy.md` 따름
- 배포 전 태그 검증 스크립트: `scripts/release/check-tag-before-deploy.sh`
- 브랜치 정리 스크립트: `scripts/release/cleanup-branches.sh`

## 6) 주의
- Next.js를 Cloudflare Pages로 배포하기 위해 workflow에서 `@cloudflare/next-on-pages` 사용
- 프로젝트 특성상 서버 기능/환경변수는 Cloudflare Pages 환경변수로 별도 등록 필요
