# Turso 마이그레이션 설정 가이드

이 앱은 데이터 저장소를 Firestore에서 Turso(libSQL)로 전환했습니다.
로그인(구글 인증)은 그대로 Firebase Auth를 사용합니다.

아래 4가지를 사용자가 직접 설정해야 실제로 동작합니다.

## 1. Turso 데이터베이스 만들기

```bash
# Turso CLI 설치 (macOS/Linux)
curl -sSfL https://get.tur.so/install.sh | bash

# 로그인
turso auth login

# 데이터베이스 생성
turso db create caltodo

# 접속 URL 확인
turso db show caltodo --url

# 인증 토큰 발급
turso db tokens create caltodo
```

CLI 대신 https://turso.tech 웹 콘솔에서도 동일하게 생성할 수 있습니다.

## 2. 스키마 적용

저장소 루트의 `turso-schema.sql` 파일을 데이터베이스에 실행합니다.

```bash
turso db shell caltodo < turso-schema.sql
```

또는 Turso 웹 콘솔의 SQL 콘솔에 `turso-schema.sql` 내용을 붙여넣어 실행해도 됩니다.

## 3. Firebase 서비스 계정 키 발급

서버(API 라우트)에서 로그인한 사용자를 검증하기 위해 필요합니다.

1. https://console.firebase.google.com/project/caltodo-b54b1/settings/serviceaccounts/adminsdk 접속
2. "새 비공개 키 생성" 클릭 → JSON 파일 다운로드
3. 이 JSON 파일의 **전체 내용을 한 줄 문자열로** 환경변수에 넣을 예정입니다.

## 4. Vercel 환경변수 등록

Vercel 프로젝트 → Settings → Environment Variables 에 아래 3개를 추가합니다.

| 이름 | 값 |
|---|---|
| `TURSO_DATABASE_URL` | 1번에서 확인한 `libsql://...` 형태의 URL |
| `TURSO_AUTH_TOKEN` | 1번에서 발급한 토큰 |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | 3번에서 받은 JSON 파일 전체 내용 (그대로 붙여넣기) |

등록 후 반드시 **Redeploy**를 눌러야 적용됩니다 (Deployments 탭 → 최신 배포 → ⋯ → Redeploy).

## 확인 방법

배포 후 로그인 → 할 일이나 일정을 추가해봤을 때 에러 토스트 없이 정상 저장되면 성공입니다.
문제가 있다면 Vercel 프로젝트의 "Functions" 로그(`/api/events` 등)에서 에러 메시지를 확인할 수 있습니다.
