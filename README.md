# routine-app

루틴앱 초기 세팅 (React Native + WebView)

## 구조

- `apps/mobile`: Expo 기반 모바일 앱 (WebView 셸)
- `apps/web`: Next.js 웹앱 (today 화면 뼈대 + Supabase 연결 준비)

## 빠른 시작

```bash
# web
cd apps/web
npm install
npm run dev

# mobile
cd ../mobile
npm install
npm run ios     # 또는 npm run android
```

## 현재 상태 (MVP 준비)

- [x] Expo(TypeScript) 앱 생성
- [x] `react-native-webview` 설치
- [x] WebView 기본 화면 구성 (`App.tsx`)
- [x] Next.js 웹앱 생성 (`apps/web`)
- [x] `/today` 화면 뼈대 생성
- [x] 모바일 WebView 로컬 URL 연결 (`http://localhost:3000/today`)
- [ ] 로그인/루틴 API 연결

## 개발 이력/롤백 문서

- 개발 이력: `docs/dev-history.md`
- 롤백 가이드: `docs/rollback-guide.md`

원칙:
- 큰 변경은 `재현 → 원인 → 해결` 3줄로 기록
- 커밋 해시를 반드시 남겨서 되돌리기 쉽게 유지

## 배포 커맨드 (원커맨드)

### 웹 배포 (Cloudflare Pages production)

```bash
./scripts/release/deploy-web.sh
```

- 릴리즈 태그(`vYYYY.MM.DD-N`)를 자동 생성/푸시
- GitHub Actions `web-cloudflare-pages` 실행 상태를 자동 모니터링

### 앱 배포 (iOS App Store Connect 업로드)

```bash
./scripts/release/deploy-ios-appstore.sh
```

- preflight → archive → export → upload를 한 번에 실행
- 실행 시 `app.json`의 `ios.buildNumber`를 자동 +1
- 버전 고정 배포 예시:

```bash
./scripts/release/deploy-ios-appstore.sh --version 1.0.1
```

- 빌드번호 직접 지정 예시:

```bash
./scripts/release/deploy-ios-appstore.sh --version 1.0.1 --build-number 3
```

- 도중 keychain 접근 허용 팝업이 뜨면 "항상 허용" 또는 "허용" 필요

## 모바일 env 설정

`apps/mobile/.env` 파일이 필요합니다(로컬 실행/빌드 공통):

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

필수 값:

- `EXPO_PUBLIC_WEB_APP_URL` (HTTPS, 예: `https://<your-pages-domain>/today`)
- `EXPO_PUBLIC_WEB_APP_ALLOWED_HOSTS` (쉼표 구분 allowlist)
