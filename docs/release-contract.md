# Release Contract (웹/앱 공통)

배포 경로가 달라도(웹: Cloudflare/Vercel+GHA, 앱: 직접 업로드) **릴리즈 기준은 하나**로 맞춘다.

## 1) 릴리즈 식별자

- Release Tag: `vYYYY.MM.DD-N` (웹)
- iOS Version: `X.Y.Z`
- iOS Build Number: 정수 문자열 (`1`, `2`, ...)

## 2) 필수 입력값

- Web Provider: `cloudflare` 또는 `vercel` (배포 전 반드시 선택)
- Web URL (모바일 WebView 대상): `https://<domain>/today`
- Allowed Hosts: `<domain>[,<domain2>...]`
- Release Notes (한 줄 요약)

## 3) env 키 정책 (모바일)

권장(신규):
- `MOBILE_WEB_APP_URL`
- `MOBILE_WEB_APP_ALLOWED_HOSTS`

레거시(호환):
- `EXPO_PUBLIC_WEB_APP_URL`
- `EXPO_PUBLIC_WEB_APP_ALLOWED_HOSTS`

코드는 신규 키 우선, 레거시 키 fallback 으로 동작한다.

## 4) 배포 전 체크리스트

- [ ] `main` 기준 배포인지 확인
- [ ] 필수 env 존재 확인 (`apps/mobile/.env`)
- [ ] 웹 배포 태그 형식 확인
- [ ] iOS 버전/빌드 번호 확인
- [ ] 롤백 기준 커밋 해시 기록

## 5) 스위칭 규칙

- 웹 배포는 `deploy-web.sh --provider <cloudflare|vercel>`로 실행한다.
- Provider가 바뀌면(`cloudflare ↔ vercel`) 모바일 WebView 대상 URL/호스트를 `.env`에 반영한다.
- Provider 스위칭 시 앱 재배포가 필요하면 iOS 배포를 자동 실행한다(기본 동작).

## 6) 배포 후 보고 포맷 (이 채널)

아래 순서 고정:
1. 재현(무엇을 실행했는지)
2. 원인(실패 시)
3. 해결(수정/우회)
4. 배포 상태(웹/앱/TestFlight/AppStore)

예시:
- 재현: `deploy-web.sh` 실행, 태그 `v2026.03.18-2`
- 원인: prod job waiting (GitHub Environment 승인 대기)
- 해결: reviewer 승인 후 재개
- 배포 상태: Web=success, iOS=upload complete, TestFlight=processing
