# CI/CD Pipeline (Web + Mobile)

## Web

Workflow: `.github/workflows/web-cloudflare-pages.yml`

- PR: web test/lint/build + Cloudflare Pages preview 배포
- Tag push (`vYYYY.MM.DD-N`): production 배포
- `production` environment 승인 게이트 지원

필수 GitHub 설정:
- Secrets
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- Variables
  - `CF_PAGES_PROJECT`

## Mobile

Workflow: `.github/workflows/mobile-ci.yml`

- PR / main push: typecheck + test
- workflow_dispatch: macOS iOS preflight 실행
  - `scripts/release/ios-local-preflight.sh`

## Release flow

1. 기능 PR 머지
2. CI 통과
3. 태그 생성 (`vYYYY.MM.DD-N`)
4. Web production 자동배포
5. iOS는 로컬 Xcode Archive → TestFlight 업로드

참고 문서:
- `docs/release-policy.md`
- `docs/release-ios-local.md`
- `docs/deploy-cloudflare-pages.md`
