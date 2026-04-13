# 완료 보고 템플릿 (강제)

## 5게이트
- [ ] run.status == completed
- [ ] run.conclusion == success
- [ ] deploy production(job) == success
- [ ] pending_deployments == 0
- [ ] 개발 채널 보고 메시지 전송 성공

## 메시지 포맷
- 작업: <작업명>
- 상태: 완료
- PR/머지: <링크>
- 배포: <tag> / <run 링크>
- 검증: <핵심 검증 2~3줄>
- 요청: "이 상태로 확인 부탁"
