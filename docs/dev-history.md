# Dev History (개발 이력)

목적: "무엇이 언제 바뀌었는지"를 빠르게 파악하고, 실수 시 되돌리기 쉽게 기록한다.

## 운영 규칙 (MVP)

- 기능/배포 관련 큰 변경은 이 파일에 3줄 요약으로 남긴다.
- 포맷: **재현 → 원인 → 해결**
- 각 항목에 commit hash를 반드시 붙인다.
- 핫픽스/롤백이 발생하면 즉시 이력 추가한다.

---

## 2026-03-18

### [007ec9d] iOS 배포 스크립트 버저닝 자동화
- 재현: TestFlight 업로드는 되지만 version/build number 관리가 수동이라 재배포 시 혼선 발생.
- 원인: 로컬 `xcodebuild` 경로에서는 EAS `autoIncrement`가 자동 적용되지 않음.
- 해결: `scripts/release/deploy-ios-appstore.sh`에 `ios.buildNumber` 자동 +1, `--version`, `--build-number` 옵션 추가.

### [87c37ed] 웹/앱 배포 원커맨드 스크립트 추가
- 재현: "웹 배포해줘 / 앱 배포해줘" 요청 대비 배포 절차가 반자동/수동 단계로 분산.
- 원인: release entrypoint 스크립트 부재.
- 해결: `deploy-web.sh`, `deploy-ios-appstore.sh` 추가 및 문서 반영.

---

## 최근 주요 기반 변경 (참고)

### [66c09ab] webview 통합 PR 머지
- 웹/모바일 브릿지 및 CI/CD 보강 관련 기반 변경 포함.

### [cb9c00c] CI/CD 완성도 보강
- web/mobile workflow 안정화 및 릴리즈 흐름 정리.

### [9ddde1a] iOS 로컬 배포 preflight 도입
- 배포 전 사전검증 자동화로 실패 확률 감소.

---

## 다음 업데이트 템플릿

```md
### [<commit>] <제목>
- 재현:
- 원인:
- 해결:
- 영향 범위: (web/mobile/ci/release)
- 롤백 기준: (문제 발생 시 어떤 커밋으로 되돌릴지)
```

## 2026-03-18

### [0701bd0] WebView 통합 후 네이티브 죽은 코드 제거
- 재현: WebView 라우트 사용 중인데 renderToday/renderCalendar/renderSettings 및 관련 상태가 잔존
- 원인: 전환 과정에서 기존 네이티브 탭 구현 정리 누락
- 해결: App.tsx에서 미사용 상태/함수/import 제거(약 273줄 정리)
- 영향 범위: mobile
