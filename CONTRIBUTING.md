# Cal2do 개발·배포 워크플로

## 브랜치 역할

- `local-first-test`: 공식 개발·Preview·테스트 브랜치
- `main`: Production 안정 버전

## 필수 작업 순서

모든 Cal2do 코드 변경은 다음 순서를 따른다.

1. **반드시 `local-first-test`에서 수정한다.**
2. 변경 사항을 commit하고 `local-first-test`에 push한다.
3. Vercel Preview 배포본에서 확인한다.
4. PC 화면을 테스트한다.
5. 모바일 세로 화면을 테스트한다.
6. 모바일 가로 화면을 테스트한다.
7. 문제가 발견되면 `local-first-test`에서 수정하고 다시 Preview에서 검증한다.
8. Preview 검증이 완료된 변경만 `local-first-test`에서 `main`으로 반영한다.
9. `main` 반영 후 Production 배포 상태를 확인한다.

## 금지 사항

- `main`에 직접 코드 수정·commit·push하지 않는다.
- 검증되지 않은 변경을 `main`에 반영하지 않는다.
- 공식 Preview/테스트 브랜치로 별도의 `preview` 브랜치를 새로 만들지 않는다.
- 기존 `local-first-test` 브랜치를 계속 사용한다.

## AI 작업 규칙

AI가 Cal2do 저장소에서 작업할 때도 위 절차를 반드시 따른다.

작업 시작 전에 프로젝트 지침의 개발·배포 규칙을 확인하고, 현재 브랜치가 `local-first-test`인지 확인한다.

## Production 원칙

`main`은 항상 검증 완료된 Production 안정 버전으로 취급한다.

긴급 장애 대응이 필요한 경우에도 먼저 `local-first-test`에서 수정·검증한 뒤 가능한 한 동일한 절차로 `main`에 반영한다.
