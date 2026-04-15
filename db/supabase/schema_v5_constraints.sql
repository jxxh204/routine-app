-- =============================================================
-- v5: 데이터 무결성 제약조건 추가
-- challenge_logs의 routine_key 및 challenge_date 검증
-- =============================================================

-- routine_key: 기본 3종 또는 커스텀 키 패턴 (소문자+숫자+하이픈, 3~30자)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'challenge_logs_routine_key_valid'
  ) THEN
    ALTER TABLE challenge_logs
      ADD CONSTRAINT challenge_logs_routine_key_valid
      CHECK (
        routine_key IN ('wake', 'lunch', 'sleep')
        OR routine_key ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'
      );
  END IF;
END $$;

-- challenge_date: 유효한 날짜이며 미래 날짜 불가 (KST 기준 오늘까지 허용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'challenge_logs_date_not_future'
  ) THEN
    ALTER TABLE challenge_logs
      ADD CONSTRAINT challenge_logs_date_not_future
      CHECK (challenge_date <= (now() AT TIME ZONE 'Asia/Seoul')::date + 1);
  END IF;
END $$;

-- friend_code: 6자 이상 영문대문자+숫자만 허용
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'profiles_friend_code_format'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_friend_code_format
      CHECK (friend_code ~ '^[A-Z0-9]{6,8}$');
  END IF;
END $$;
