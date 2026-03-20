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
- [x] `/auth?next=` 기반 복귀 경로 고정
- [x] OAuth 시작 전 복귀 경로 저장(sessionStorage)
- [x] callback 후 세션 감지 시 복귀 경로 사용

### Step 2 (P0): 오류/취소 UX
- [x] 취소/실패 케이스별 사용자 메시지 분리
- [x] 재시도 버튼/가이드 문구 제공

### Step 3 (P0): 세션 복구 안정화
- [x] 앱 재실행 및 새로고침 시 세션 유지 검증 로직(세션 재시도 + auth state listener)
- [x] 보호 페이지 진입 회귀 테스트

### Step 4 (P1): 친구 기능 연결
- [x] 로그인 선행 후 친구 페이지 요청/수락 플로우 회귀 QA

---

## 6) QA 체크리스트

- [x] 비로그인 `/today` -> `/auth?next=/today`
- [x] 카카오 로그인 성공 -> `/today` 복귀
- [x] 비로그인 `/friends` -> 로그인 후 `/friends` 복귀
- [x] 로그인 취소 시 `/auth` 유지 + 실패 메시지
- [x] 앱 재실행 후 세션 유지

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

- [x] P0 QA 체크리스트 100% 통과
- [x] 모바일 실기기에서 카카오 로그인 성공/복귀 확인
- [x] 로그인 실패 시 사용자 메시지 확인 가능
- [x] 코드/문서 커밋 완료

## 9) 진행 로그 (2026-03-20)

### Step 1 (P0): Auth 플로우 고정
- 재현: 비로그인 상태에서 `/today`, `/friends` 진입 시 콜백 이후 원래 경로 복귀가 간헐적으로 불안정한지 확인.
- 원인: OAuth callback 시점의 세션 반영 타이밍 차이와 `next` 파라미터 유실 가능성.
- 해결: `next` 내부 경로 검증(`resolvePostLoginPath`) + `sessionStorage` 이중 보관 + callback 이후 복귀 경로 재사용으로 고정.
- QA: `auth-redirect` 단위 테스트 및 보호 경로 진입 회귀 시나리오 통과.
- 다음스텝: 실패/취소 UX 메시지 분리.

### Step 2 (P0): 오류/취소 UX
- 재현: OAuth 취소/실패 시 사용자에게 동일한 오류 문구만 보이는 문제 확인.
- 원인: callback query(`error`, `error_description`) 분기 미흡.
- 해결: 취소/실패 문구를 분리하고 `다시 시도하기` 액션을 추가.
- QA: `auth-error` 단위 테스트 및 `/auth` 화면 수동 확인 통과.
- 다음스텝: callback 직후 세션 복구 안정화.

### Step 3 (P0): 세션 복구 안정화
- 재현: callback 직후 `getSession()` 타이밍 이슈로 `/auth`에 머무는 케이스 확인.
- 원인: 세션 생성 지연과 단일 조회 의존.
- 해결: `getSessionWithRecovery` 재시도 유틸 + auth state listener(`INITIAL_SESSION`, `SIGNED_IN`) 적용.
- QA: `session-recovery` 단위 테스트 및 보호 페이지 회귀 확인 통과.
- 다음스텝: 친구 페이지 로그인 선행 플로우 회귀 검증.

### Step 4 (P1): 친구 기능 연결
- 재현: 비로그인 `/friends` 접근에서 인증 선행 및 복귀 연계 확인 필요.
- 원인: 인증/복귀 플로우가 `/today` 중심으로 먼저 고정되어 친구 페이지 회귀 검증이 필요.
- 해결: `/friends -> /auth?next=/friends -> /friends` 복귀 시나리오를 기준 플로우에 포함.
- QA: 친구 요청/수락 기본 회귀 QA 및 `friends` 관련 테스트 통과.
- 다음스텝: 본 문서 완료 처리 및 필수 테스트 재실행.

### 최종 상태
- 완료율: **100% (Step 1~4 완료, QA 체크리스트 5/5 완료)**
- 배포 작업/배포 의사결정/외부 공개 작업: **미수행(정책 준수)**
