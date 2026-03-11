# routine-app

루틴앱 초기 세팅 (React Native + WebView)

## 구조

- `apps/mobile`: Expo 기반 모바일 앱 (WebView 셸)
- `apps/web`: 웹앱 자리 (기획 후 생성 예정)

## 빠른 시작

```bash
cd apps/mobile
npm install
npm run ios     # 또는 npm run android
```

## 현재 상태 (MVP 준비)

- [x] Expo(TypeScript) 앱 생성
- [x] `react-native-webview` 설치
- [x] WebView 기본 화면 구성 (`App.tsx`)
- [ ] 웹앱 URL 확정 (`WEB_APP_URL` 교체)
- [ ] 로그인/루틴 API 연결

## 설정 포인트

`apps/mobile/App.tsx`의 아래 값을 실제 웹앱 주소로 바꿔주세요.

```ts
const WEB_APP_URL = 'https://example.com';
```
