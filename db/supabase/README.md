# Supabase DB v1

## 적용 순서
1. Supabase 프로젝트 생성
2. SQL Editor 열기
3. `schema_v1.sql` 전체 실행

## MVP 쿼리 체크
- 그룹 생성: `groups` insert + `group_members(owner)` insert
- 초대코드 가입: `invite_code`로 그룹 조회 후 `group_members` insert
- 오늘 루틴 조회: `routines where group_id = ? and is_active = true`
- 완료 체크: `routine_logs` upsert (`routine_id,user_id,log_date` unique)

## 저비용 운영 팁
- 인덱스는 현재 2개만 유지
- 실시간 구독은 오늘 화면에서만 사용
- 로그 보관은 최근 90일 우선
