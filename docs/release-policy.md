# Release Policy

웹뷰 통일 브랜치 포함, 모든 배포는 아래 규칙을 따른다.

## 1) 태그 없는 배포 금지

- 배포 전 반드시 Git 태그를 생성/푸시한다.
- 형식: `vYYYY.MM.DD-N`
  - 예: `v2026.03.17-1`

### 표준 순서
1. `main` 또는 승인된 release 브랜치 최신화
2. smoke test 통과
3. 태그 생성/푸시
4. 배포 실행

```bash
git tag -a v2026.03.17-1 -m "release: 핵심 변경 3줄 요약"
git push origin v2026.03.17-1
```

## 2) 브랜치 수명 정책

- PR 머지 완료 브랜치: 24시간 내 정리
- 예외 브랜치: 명시된 장기 브랜치 (예: `feat/webview-unification`)
- 정리 후보 기준:
  - main에 머지됨
  - 최근 7일 커밋 없음
  - 열린 PR 없음

## 3) 정기 클린업

- 주 1회 (월요일 10:00 KST)
- `scripts/release/cleanup-branches.sh`로 후보를 확인 후 삭제
- 결과는 개발 채널에 공유

## 4) iOS 배포 방식

- EAS Cloud Build 대신 로컬 Xcode Archive + TestFlight 업로드 사용
- 절차는 `docs/release-ios-local.md` 참고

## 5) 검증 체크리스트

- 웹: lint/build 통과
- 모바일: 타입체크/기능 시나리오 확인
- 릴리즈 노트/태그 메시지 작성
- 롤백 포인트(직전 태그) 명시
