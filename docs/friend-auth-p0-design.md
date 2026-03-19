# 친구 연동 + 소셜 로그인 P0 설계서 (개발 전용)

작성일: 2026-03-19  
범위: UI ~ 로직 ~ DB (배포 내용 제외)
전제: 모바일 Expo 미사용, 앱/웹/백엔드 트랙별 TDD

---

## 1) 목표

- 친구와 루틴 인증 상태/이미지 공유
- 미인증 친구에게 독려 푸시(기본: 루틴별 1회/일)
- 소셜 로그인 P0: **카카오 + 애플**

## 2) MVP 결정

### 인증 Provider
- P0: 카카오, 애플
- P1: 구글

### 푸시 정책
- 기본: once (루틴별 1회/일)
- 옵션 구조: twice 확장 가능 (P1)
- quiet hours 기본: 23:00~08:00

---

## 3) UI 설계

### 3.1 로그인 화면
- 버튼: `카카오로 시작`, `Apple로 로그인`
- 상태: 로그인 처리중, 실패 재시도
- 계정연동: 같은 이메일/subject 매핑 시 기존 계정 연결
- 디자인 가이드라인 반영:
  - 카카오: 공식 제공 로그인 버튼 이미지 사용
  - 애플: 공식 JS Sign in with Apple 버튼 렌더 사용 (`NEXT_PUBLIC_APPLE_SERVICE_ID` 필요)
  - 구글(P1): 공식 제공 Google Sign-in 버튼 적용
  - 공식 버튼 로드 실패/설정 미완료 시 명시적 오류 UI 노출

### 3.2 친구 관리 화면
- 내 친구코드 카드 + 복사
- 친구코드 입력 + 요청 버튼
- 탭: 받은 요청 / 보낸 요청 / 친구 목록
- 액션: 수락, 거절, 차단

### 3.3 오늘 화면(친구 연동)
- 내 루틴 카드(기존)
- 친구 상태 리스트: 완료/미완료/완료 시각
- 독려 버튼: 조건 충족 시만 활성
- 인증 가드: 비로그인 상태에서 `/auth?next=/today` 리다이렉트

### 3.4 캘린더 상세 모달
- 내 인증 내역 + 친구 인증 내역
- 인증 이미지 썸네일

### 3.5 알림 설정
- 독려 알림 on/off
- 빈도: once/twice
- quiet hours 설정

---

## 4) 도메인 로직

### 4.1 핵심 규칙
1. 친구 데이터는 accepted 관계에서만 조회
2. 차단 상태는 조회/푸시 모두 차단
3. 독려 푸시는 dedupe_key로 중복 방지
4. 루틴별 하루 최대 1회(once)
5. quiet hours 시간대 발송 금지

### 4.2 독려 발송 판정
입력: sender(A), target(B), date, routine_key

- A가 해당 루틴 완료인가?
- B가 동일 date/routine 미완료인가?
- A-B가 accepted인가?
- B 설정이 off가 아닌가?
- 현재 시각이 B quiet hours 밖인가?
- dedupe_key 미존재인가?

모두 true일 때만 발송.

---

## 5) DB 스키마 (P0)

- `profiles` (friend_code 포함)
- `friendships` (pending/accepted/blocked)
- `challenge_logs` 확장 (proof_image_path, visibility)
- `push_tokens` (provider: apns/fcm)
- `user_push_prefs` (nudge_mode, quiet hours)
- `push_events` (dedupe_key unique)

상세 SQL: `db/supabase/schema_v4_friend_auth_p0.sql`

---

## 6) 이벤트 플로우

1. A 인증 완료 (로그 + 이미지 경로 저장)
2. 서버 함수에서 A의 accepted 친구 조회
3. 친구별 발송 조건 평가
4. push_events insert (dedupe)
5. 성공 시 APNs/FCM 발송
6. UI 상태 업데이트

---

## 7) TDD 계획

### 앱
- 친구 요청 상태 전이 테스트
- 독려 버튼 활성/비활성 조건 테스트

### 웹
- 친구 상태 컴포넌트 렌더 테스트
- 캘린더 친구 이미지 표시 테스트

### 백엔드
- nudge 판정 함수 테스트
- dedupe 충돌 시 스킵 테스트
- quiet hours 차단 테스트
- blocked 차단 테스트

---

## 8) 작업 순서 (P0)

1. DB 마이그레이션 + RLS 초안
2. 로그인 UI/콜백 처리 (카카오/애플)
3. 친구 관리 UI + API
4. 오늘/캘린더 친구 상태 연동
5. 독려 판정 함수 + 푸시 이벤트 기록
6. 통합 회귀 테스트

## 9) 현재 반영된 착수 결과

- `db/supabase/schema_v4_friend_auth_p0.sql`
  - friendships/push 관련 테이블 + RLS 초안 포함
- `apps/web/src/app/auth/page.tsx`
  - P0 소셜로그인(카카오/애플) 버튼 UI
- `apps/web/src/lib/social-login.ts`
  - provider별 OAuth 시작 함수
- `apps/web/src/lib/social-official-button-assets.ts`
  - provider별 공식 버튼 에셋 매핑
- `apps/web/src/components/auth-required.tsx`
  - 비로그인 시 `/auth?next=...` 리다이렉트 가드
- `apps/web/src/app/friends/page.tsx`
  - 친구코드 요청/요청목록/수락 UI 초안
- `apps/web/src/lib/friends.ts`
  - friendships 조회/요청/수락 API 함수
- 테스트
  - `social-auth-policy.test.ts`
  - `social-login.test.ts`
  - `social-official-button-assets.test.ts`
  - `friend-code.test.ts`
