# Cal2do (caltodo)

> **갤럭시 폰과 PC에서 실시간 동기화되는 나만의 캘린더 & 할 일 & 메모 관리 애플리케이션**

[![Next.js](https://img.shields.io/badge/Next.js-14.2.5-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-blue?style=flat&logo=react)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%26%20Firestore-orange?style=flat&logo=firebase)](https://firebase.google.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4.1-38bdf8?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![E2E Tests](https://img.shields.io/badge/E2E%20Tests-PASS-success?style=flat&logo=googlechrome)](./e2e)

---

## 📌 주요 기능

* **오늘 뷰 (Today)**: 오늘의 일정, 실시간 할 일 빠른 등록 및 우선순위 색상 관리
* **일정 뷰 (Calendar)**: 음력 일자 및 공휴일(광복절, 대체공휴일 등)이 포함된 월간/주간 캘린더 그리드
* **할 일 뷰 (Todo)**: 카테고리/폴더별 할 일 관리 및 체크리스트
* **메모 뷰 (Memo)**: 빠른 메모 작성, 폴더 분류 및 삭제된 메모 보관함
* **사이드 드로어**: 이메일 백업, 일정 데이터 관리, 기념일 관리, 다크/라이트 테마 전환
* **반응형 멀티 디바이스**: 데스크톱(PC) 및 모바일 스마트폰(Galaxy/iPhone 등) 완벽 대응

---

## 🛠️ 개발 및 실행 방법

### 1. 패키지 설치
```bash
npm install
```

### 2. 로컬 개발 서버 실행
```bash
npm run dev
```
브라우저에서 `http://localhost:3000`으로 접속합니다.

### 3. 프로덕션 빌드
```bash
npm run build
npm run start
```

---

## 🧪 공식 E2E 자동 회귀 테스트 (Automated Regression Test)

Cal2do 프로젝트는 **Chrome DevTools Protocol (CDP)** 기반의 경량화된 브라우저 자동화 회귀 테스트 스위트를 포함하고 있습니다.
추가 무거운 테스트 프레임워크 설치 없이 Node.js 표준 환경(v18+)에서 즉시 동작합니다.

### 1. 테스트 실행 환경 설정
`e2e/.env.test.example`을 복사하여 `.env.test` 또는 `.env.test.local` 파일을 생성합니다.

```bash
# .env.test 파일 생성 (기본 배포본 테스트 시 설정 없이 바로 실행 가능)
cp e2e/.env.test.example .env.test
```

#### 주요 환경 변수 설정
| 환경 변수 | 기본값 | 설명 |
| :--- | :--- | :--- |
| `TEST_BASE_URL` | `https://caltodo-lbbz.vercel.app/` | 테스트 대상 URL (로컬 테스트 시 `http://localhost:3000`) |
| `CHROME_PATH` | (자동 감지) | Chrome / Chromium / Edge 브라우저 실행 파일 경로 |
| `CHROME_DEBUG_PORT` | `9555` | 브라우저 원격 디버깅 포트 |
| `HEADLESS` | `true` | 헤드리스 브라우저 모드 (`false` 시 화면에 브라우저 표시) |
| `TEST_GOOGLE_EMAIL` | `""` | 테스트 계정 이메일 (시크릿 격리) |
| `TEST_GOOGLE_PASSWORD` | `""` | 테스트 계정 비밀번호 (시크릿 격리) |

> 🔒 **보안 안내**: `.env.test`, `.env.test.local` 및 테스트 브라우저 세션/스크린샷은 `.gitignore`에 등록되어 있어 GitHub에 절대 노출되거나 커밋되지 않습니다.

### 2. 자동 회귀 테스트 실행
```bash
npm run test:e2e
```

### 3. 회귀 테스트 검증 항목 (10 Core Items)
1. **첫 화면 (Landing)**: HTTP 200 OK, 번들/스타일/폰트 정상 로드 및 구글 시작하기 렌더링
2. **Google OAuth 인증 연동**: Firebase Auth 및 Google OAuth 핸들러 세션 연동
3. **로그인 메인 대시보드**: 상단 네비게이션, 검색바, 빠른 할 일, 액션 버튼 렌더링
4. **탭 전환 및 서브 뷰**: 오늘 / 일정(월간 달력) / 할일 / 메모 탭 전환 무결성
5. **사이드 드로어 메뉴**: 백업, 일정 관리, 기념일 관리, 로그아웃 항목 노출
6. **데이터 영속성 (Persistence)**: 새로고침 후 세션 및 사용자 데이터 정상 유지
7. **모바일 반응형 UI**: 390×844 모바일 뷰포트에서 가로 스크롤(Overflow) 없음 검증
8. **PC ↔ 모바일 데이터 동기화**: 반응형 뷰포트 간 동일 데이터 실시간 조회
9. **브라우저 콘솔 오류 감사**: Console Error 0건 검증
10. **네트워크 HTTP 오류 감사**: HTTP 4xx/5xx 비정상 응답 0건 검증

---

## 📂 프로젝트 구조

```
Cal2do/
├── app/                  # Next.js App Router 페이지 및 API 라우트
├── components/           # UI 컴포넌트 (캘린더, 할 일, 메모, 모달, 드로어 등)
├── lib/                  # Firebase 및 DB 라이브러리 연동
├── public/               # 파비콘, 매니페스트, 웹폰트, 정적 에셋
├── e2e/                  # 공식 E2E 자동 회귀 테스트 스위트
│   ├── regression.test.mjs # 메인 회귀 테스트 실행기
│   ├── helpers.mjs       # 브라우저 자동 감지 및 CDP 제어 유틸리티
│   └── .env.test.example # 테스트 환경 설정 템플릿
├── README.md             # 프로젝트 안내 및 테스트 가이드 문서
├── package.json
└── tailwind.config.ts
```