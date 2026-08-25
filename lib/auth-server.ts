import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';

// FIREBASE_SERVICE_ACCOUNT_KEY 환경변수(JSON 문자열 전체)를 사용해 초기화.
// Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > "새 비공개 키 생성"으로 받은
// JSON 파일 내용을 그대로 한 줄 문자열로 Vercel 환경변수에 등록해야 함.
let app: App;

export function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY 환경변수가 설정되지 않았습니다.');
  }
  const serviceAccount = JSON.parse(raw);
  app = initializeApp({ credential: cert(serviceAccount) });
  return app;
}

/** 요청의 Authorization: Bearer <idToken> 헤더를 검증하고 uid를 반환. 실패 시 null. */
export async function verifyRequestUser(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) return null;
    const idToken = match[1];
    const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken);
    return decoded.uid;
  } catch (err) {
    console.error('토큰 검증 실패:', err);
    return null;
  }
}

/** 구글 로그인 시 등록된 사용자 이메일 조회 (백업 이메일 발송용) */
export async function getUserEmail(uid: string): Promise<string | null> {
  try {
    const userRecord = await getAuth(getAdminApp()).getUser(uid);
    return userRecord.email || null;
  } catch (err) {
    console.error('사용자 이메일 조회 실패:', err);
    return null;
  }
}
