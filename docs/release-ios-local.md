# iOS 로컬 배포 가이드 (EAS Cloud 미사용)

목표: EAS 빌드 횟수 제한 없이, 로컬 Mac/Xcode로 TestFlight 배포.

## 0) 전제
- macOS + Xcode 최신 설치
- Apple Developer 계정 로그인 완료 (Xcode > Settings > Accounts)
- 프로젝트 루트: `routine-app/apps/mobile`

## 1) 준비
```bash
cd apps/mobile
npm ci
cp .env.example .env   # 없으면 생성
npx expo prebuild --platform ios
```

필수 env:
- `EXPO_PUBLIC_WEB_APP_URL` (HTTPS)
- `EXPO_PUBLIC_WEB_APP_ALLOWED_HOSTS`

> 이미 `ios/`가 있고 네이티브 변경이 없으면 prebuild 생략 가능.

### 권장: 사전 점검 스크립트
```bash
cd /Users/jaehwan/.openclaw/workspace/routine-app
./scripts/release/ios-local-preflight.sh
```

- Node/npm/Expo/Xcode 툴체인 확인
- `tsc --noEmit`, `npm run test` 자동 점검
- prebuild 메타 검증

## 2) Xcode 아카이브
1. `apps/mobile/ios/*.xcworkspace` 열기
2. Scheme: 앱 타깃 선택
3. Signing & Capabilities 확인
4. Product > Archive 실행

## 3) TestFlight 업로드
1. Organizer에서 아카이브 선택
2. Distribute App > App Store Connect > Upload
3. 업로드 완료 후 App Store Connect에서 빌드 상태 확인

## 4) 릴리즈 체크
- 내부 테스터 배포 가능 여부
- 앱 실행/로그인/오늘탭/캘린더/설정탭 정상 동작
- 카메라 인증/사진 선택/다시찍기 정상 동작

## 5) 장애 대응
- 서명 오류: Bundle Identifier / Team / Provisioning 재확인
- 빌드 오류: `npx expo prebuild --clean --platform ios` 후 재시도
- 업로드 오류: Xcode/Transporter 재로그인 후 재업로드

## 6) 리허설 체크(2026-03-17)
- `npx expo --version` 확인: 55.0.15
- `npx expo prebuild --help` 확인: prebuild 명령 사용 가능
- `xcodebuild -version` 확인: Xcode 26.3 (17C529)
- 참고: 실제 Archive/TestFlight 업로드는 Xcode GUI 단계라 수동 실행 필요
