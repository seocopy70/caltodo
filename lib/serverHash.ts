import { createHash, randomInt } from 'crypto';

export function hashCodeServer(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** 6자리 숫자 인증코드 생성 (이메일로 발송할 복구 코드) */
export function generateResetCode(): string {
  return String(randomInt(0, 1000000)).padStart(6, '0');
}
