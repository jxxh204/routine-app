# 루틴 챌린지 릴리즈 체크리스트 (MVP)

## 1) 사전 준비
- [ ] 브랜치: `feat/today-ui-v1`
- [ ] PR 확인: https://github.com/jxxh204/routine-app/pull/1
- [ ] 최신 커밋 pull 완료

## 2) DB 적용 (필수)
- [ ] Supabase SQL Editor 열기
- [ ] `db/supabase/schema_v2_challenge_logs.sql` 실행
- [ ] `challenge_logs` 테이블 생성 확인
- [ ] unique(user_id, challenge_date, routine_key) 제약 확인
- [ ] RLS 정책 적용 확인

## 3) 환경변수 설정 (친구 상태 기능)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `NEXT_PUBLIC_BUDDY_USER_ID` (친구 auth.users.id)

## 4) 기능 검증 (필수)
- [ ] 기상 인증: 09:00~11:00에서만 활성
- [ ] 식사 인증: 12:30~13:30에서만 활성
- [ ] 취침 인증: 23:00~02:00에서만 활성
- [ ] 같은 루틴 당일 재인증 불가
- [ ] 새로고침 후 인증 상태 유지

## 5) 동기화 검증
- [ ] 내 인증 클릭 시 `Supabase 저장 완료`
- [ ] 친구 계정 인증 후 내 화면 상태 반영
- [ ] 실시간 반영 실패 시 60초 내 폴백 반영

## 6) 머지 기준
- [ ] lint 통과
- [ ] 위 4~5번 항목 모두 통과
- [ ] 회귀 이슈 없음

## 7) 머지 후 확인
- [ ] main 배포 반영
- [ ] `/today` 화면 정상 접근
- [ ] 첫 사용자 1회 인증 end-to-end 확인
