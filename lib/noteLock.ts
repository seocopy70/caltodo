// 비밀메모(PIN/패턴) 잠금용 해시 helper.
// ⚠️ 이 잠금은 "화면 가림" 수준의 단순 보호입니다. 코드(PIN/패턴)는 원문으로 저장하지 않고
// SHA-256 해시만 저장/비교하지만, 메모 내용 자체가 서버에서 암호화되는 것은 아닙니다.

export async function hashCode(code: string): Promise<string> {
  const enc = new TextEncoder().encode(code);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
