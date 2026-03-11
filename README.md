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

## 설정 포인트

개발 중에는 `apps/mobile/App.tsx`가 로컬 웹으로 연결되어 있습니다.

```ts
const WEB_APP_URL = 'http://localhost:3000/today';
```

배포 전에는 운영 URL로 교체하세요.
