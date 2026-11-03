/**
 * 새 항목을 만들 때 클라이언트가 미리 정해 보내는 id.
 * 같은 요청이 두 번 도착해도(응답을 못 받아 다시 보낸 경우 등) 서버가 한 번만 저장하게 하는 데 쓴다.
 * 서버/클라이언트 양쪽에서 쓰는 순수 함수만 둔다.
 */
export function newClientId(): string {
  const c: any = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const hex = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  return `${hex()}${hex()}${hex()}${hex()}`;
}

/** 서버가 믿고 쓸 수 있는 클라이언트 id 형식인지(UUID/영숫자·-·_ 16~64자) 확인 */
export function isValidClientId(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(v);
}
