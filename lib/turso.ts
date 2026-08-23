import { createClient } from '@libsql/client';

// 서버(Next.js API 라우트)에서만 사용. 브라우저에 토큰이 노출되면 안 되므로
// 클라이언트 컴포넌트에서 직접 import하지 말 것.
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.warn('[turso] TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 환경변수가 설정되지 않았습니다.');
}

export const turso = createClient({
  url: url || 'file:local.db',
  authToken,
});
