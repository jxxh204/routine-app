# 카카오 로그인 적용 체크리스트 (MVP / WebView 앱 기준)

목표: `카카오 로그인 -> 완료 -> 보호 페이지(/today, /friends)` 흐름을 안정적으로 고정한다.

---

## 1) 표준 플로우 고정

1. 비로그인 상태에서 `/today`, `/friends` 접근
2. `AuthRequired`가 `/auth?next=<원래경로>`로 리다이렉트
3. `/auth`에서 카카오 로그인 버튼 클릭
4. Supabase `signInWithOAuth({ provider: 'kakao' })` 호출
5. 카카오 인증/동의 완료
6. Supabase callback으로 복귀 + 세션 생성
7. `/auth`에서 세션 감지 후 `ensureMyProfile()` 실행
8. `next` 경로로 `router.replace(next)`

핵심 원칙:
- OAuth 진행 중 provider/supabase 도메인 왕복은 WebView 내부에서 유지
- 인증 화면(`/auth`)에서는 앱 셸 탭/헤더 숨김

---

## 2) 콘솔/플랫폼 설정 매핑

### A. Kakao Developers

- 앱 생성
- 플랫폼 > Web 등록
  - 사이트 도메인: `https://<your-web-domain>`
- 카카오 로그인 활성화
- Redirect URI 등록
  - `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
  - Supabase에 설정한 callback과 **문자 단위 완전 일치**해야 함
- 동의항목 설정(MVP 최소)
  - 프로필 닉네임/프로필 이미지(필요 시)
  - 이메일(정말 필요한 경우만)
- 앱 키 확인
  - REST API 키
  - (필요 시) JavaScript 키

### B. Supabase Auth

- Authentication > Providers > Kakao 활성화
- Kakao Client ID/Secret 입력 (Kakao에서 발급된 값)
- URL Configuration
  - Site URL: `https://<your-web-domain>`
  - Additional Redirect URLs 예시:
    - `https://<your-web-domain>/auth`
    - `https://<your-web-domain>/today`
    - `https://<your-web-domain>/friends`
- 세션 정책 확인
  - 기본 만료시간/리프레시 동작 사용 (MVP)

### C. 앱(WebView) 환경값

- `apps/web/.env.local`
  - `NEXT_PUBLIC_SUPABASE_URL=https://<SUPABASE_PROJECT_REF>.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>`
  - (Apple 사용 시) `NEXT_PUBLIC_APPLE_SERVICE_ID=<service-id>`
- `apps/mobile/.env`
  - `MOBILE_WEB_APP_URL=https://<your-web-domain>/today`
  - `MOBILE_WEB_APP_ALLOWED_HOSTS=<your-web-domain>,<SUPABASE_PROJECT_REF>.supabase.co,kauth.kakao.com,accounts.kakao.com`

주의:
- `MOBILE_WEB_APP_ALLOWED_HOSTS`가 너무 좁으면 OAuth 이동이 차단될 수 있음
- 너무 넓히면 보안 리스크 증가. 실제 필요 도메인만 등록

---

## 3) 코드 체크포인트 (현재 리포 기준)

- `apps/web/src/app/auth/page.tsx`
  - 로그인 성공 세션 감지 후 `ensureMyProfile()` + `next` 리다이렉트
- `apps/web/src/lib/social-login.ts`
  - `provider: 'kakao'`로 OAuth 시작
- `apps/mobile/App.tsx`
  - `/auth` 경로에서 탭/헤더 숨김
  - OAuth 도메인 이동을 WebView 내부 허용

---

## 4) QA 시나리오 (반드시 통과)

1. 비로그인 상태 `/today` 진입 -> `/auth?next=/today`로 이동
2. 카카오 로그인 성공 -> `/today` 자동 복귀
3. 비로그인 상태 `/friends` 진입 -> 로그인 후 `/friends` 복귀
4. 카카오 로그인 취소 -> `/auth`에 머물며 에러 메시지 표시
5. 앱 재실행 후 세션 유지 -> `/auth` 재진입 없이 보호 페이지 접근 가능

---

## 5) 트러블슈팅 빠른 점검

- 400/redirect_uri mismatch
  - Kakao Redirect URI와 Supabase callback URI 불일치
- 로그인 성공했는데 `/auth`에 머묾
  - callback 후 세션 감지 실패(환경변수/쿠키/도메인 확인)
- 앱에서 로그인 후 다시 비로그인 상태
  - OAuth 과정이 외부 브라우저로 빠졌는지 확인(WebView 내부 유지 필요)
- 특정 기기에서만 실패
  - WebView 캐시/쿠키 초기화 후 재시험

---

## 6) MVP 범위 선언

- 이번 스코프: 카카오 로그인 안정화(P0)
- 다음 스코프: 친구 요청/수락 기능(P1)
- 배포/릴리즈 의사결정은 본 채널 규칙상 제외(개발 항목만 진행)
