# Rollback Guide (되돌리기 가이드)

목표: 실수/장애 발생 시 **빠르고 안전하게 이전 안정 상태로 복구**한다.

## 0) 공통 원칙

1. 먼저 재현 증상을 1~2줄로 기록
2. 영향 범위 확인 (web / mobile / ci / release)
3. 가장 작은 범위부터 되돌리기 (파일 단위 → 커밋 단위)
4. 롤백 후 즉시 smoke test

---

## 1) 파일 단위 되돌리기 (가장 안전)

```bash
# 특정 파일만 마지막 커밋 기준으로 복구
git restore <path>

# 예시
git restore scripts/release/deploy-ios-appstore.sh
```

사용 시점:
- 특정 스크립트 수정이 문제일 때
- 아직 커밋/푸시 전일 때

---

## 2) 커밋 단위 되돌리기 (공유 브랜치 안전)

```bash
# 문제 커밋을 되돌리는 "역커밋" 생성
git revert <commit_hash>
```

예시:
```bash
git revert 007ec9d
```

사용 시점:
- 이미 main에 반영된 변경을 안전하게 되돌릴 때
- 히스토리 보존이 필요할 때

---

## 3) 강한 되돌리기 (로컬 전용, 주의)

```bash
# 로컬 HEAD를 특정 커밋으로 강제 이동
git reset --hard <commit_hash>
```

주의:
- 협업/원격 반영 브랜치에서 사용 금지(또는 매우 신중)
- 원격까지 강제 반영하려면 force push 필요 (권장하지 않음)

---

## 4) 배포 장애 시 즉시 대응 체크리스트

### Web 배포 실패
1. `gh run view <run-id> --log-failed`로 실패 step 확인
2. 태그/환경변수/Cloudflare token 검증
3. 마지막 안정 태그 재배포

### iOS 배포 실패
1. Keychain 권한 팝업 승인 여부 확인
2. provisioning/profile 자동생성 허용(`-allowProvisioningUpdates`) 확인
3. `apps/mobile/.env`의 `EXPO_PUBLIC_WEB_APP_URL` 확인
4. 필요 시 직전 안정 커밋 revert 후 재배포

---

## 5) 권장 운영

- 배포 전: `docs/dev-history.md`에 변경 3줄 요약 작성
- 배포 후: 성공/실패 결과와 복구 포인트 기록
- 장애 후: "원인 + 재발방지" 한 줄이라도 반드시 남기기
