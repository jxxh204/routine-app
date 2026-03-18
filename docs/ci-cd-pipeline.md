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
3. 아래 원커맨드 실행

### 웹

```bash
./scripts/release/deploy-web.sh
```

- 태그 생성/푸시 + production 배포 워크플로 모니터링까지 포함

### iOS 앱

```bash
./scripts/release/deploy-ios-appstore.sh
```

- preflight + archive + export + App Store Connect upload 자동화

참고 문서:
- `docs/release-policy.md`
- `docs/release-ios-local.md`
- `docs/deploy-cloudflare-pages.md`
