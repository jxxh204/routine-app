# 카카오 로그인 전체 설계서 (MVP 우선)

작성 목적: 루틴앱에서 카카오 로그인 플로우를 표준화하고, 기능 개발을 단계별로 진행하기 위한 단일 기준 문서.

---

## 0) 목표 / 비목표

### 목표 (MVP)
- 앱(WebView)에서 카카오 로그인 성공 시 세션이 유지되고 보호 페이지(`/today`, `/friends`)로 복귀
- 인증 화면(`/auth`)은 별도 화면처럼 동작(앱 탭/헤더 숨김)
- 실패/취소 시 사용자에게 명확한 안내 문구 제공

### 비목표 (이번 스코프 제외)
- 친구 기능 고도화(요청 취소, 차단, 추천친구 등)
- 배포 자동화/릴리즈 운영 의사결정

---

## 1) 사용자 플로우

1. 사용자가 `/today` 또는 `/friends` 접근
2. 세션 없음 -> `/auth?next=<원래경로>` 리다이렉트
3. 사용자가 카카오 로그인 버튼 클릭
4. Supabase OAuth 시작 (`provider='kakao'`)
5. 카카오 인증/동의
6. Supabase callback 복귀
7. 웹앱에서 세션 감지 + `ensureMyProfile()`
8. `next` 경로로 이동

예외 플로우:
- 로그인 취소/권한 거부 -> `/auth` 유지 + 에러 안내
- callback은 왔는데 세션 없음 -> 재시도 안내 + 진단 메시지

---

## 2) 아키텍처 요약

### Web
- `AuthRequired`: 보호 페이지 접근 전 세션 체크
- `/auth`: 소셜 로그인 시작 + callback 후 세션 확인 + next 리다이렉트
- `social-login.ts`: Supabase OAuth 호출 래퍼

### Mobile (WebView shell)
- 현재 웹 경로 추적
- `/auth` 경로에서는 탭/헤더 숨김
- OAuth 공급자 도메인 이동은 WebView 내부 허용

---

## 3) 설정 요구사항

### Kakao Developers
- 플랫폼 Web 도메인 등록
- Redirect URI 등록: `https://<supabase-ref>.supabase.co/auth/v1/callback`
- 카카오 로그인 활성화

### Supabase
- Providers > Kakao 활성화
- Client ID/Secret 설정
- Site URL / Additional Redirect URLs 등록

### Environment
- Web: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Mobile: `MOBILE_WEB_APP_URL`, `MOBILE_WEB_APP_ALLOWED_HOSTS`

---

## 4) 데이터/보안 정책

- `next` 파라미터는 내부 경로(`/`로 시작)만 허용
- 외부 URL 리다이렉트 금지
- 허용 host 기반으로 WebView 외부 이동 차단

---

## 5) 단계별 개발 계획

### Step 1 (P0): Auth 플로우 고정
- `/auth?next=` 기반 복귀 경로 고정
- OAuth 시작 전 복귀 경로 저장(sessionStorage)
- callback 후 세션 감지 시 복귀 경로 사용

### Step 2 (P0): 오류/취소 UX
- 취소/실패 케이스별 사용자 메시지 분리
- 재시도 버튼/가이드 문구 제공

### Step 3 (P0): 세션 복구 안정화
- 앱 재실행 및 새로고침 시 세션 유지 검증
- 보호 페이지 진입 회귀 테스트

### Step 4 (P1): 친구 기능 연결
- 로그인 선행 후 친구 페이지 요청/수락 플로우 검증

---

## 6) QA 체크리스트

- [ ] 비로그인 `/today` -> `/auth?next=/today`
- [ ] 카카오 로그인 성공 -> `/today` 복귀
- [ ] 비로그인 `/friends` -> 로그인 후 `/friends` 복귀
- [ ] 로그인 취소 시 `/auth` 유지 + 실패 메시지
- [ ] 앱 재실행 후 세션 유지

---

## 7) 리스크와 대응

리스크 1) redirect_uri mismatch
- 대응: Kakao Redirect URI와 Supabase callback URI 완전 일치 검증

리스크 2) 로그인 성공 후 세션 미반영
- 대응: OAuth 과정 WebView 내부 유지 + callback 직후 `getSession()` 재확인

리스크 3) next 유실
- 대응: query + sessionStorage 이중 보관

---

## 8) 완료 기준(Definition of Done)

- P0 QA 체크리스트 100% 통과
- 모바일 실기기에서 카카오 로그인 성공/복귀 확인
- 로그인 실패 시 사용자 메시지 확인 가능
- 코드/문서 커밋 완료
