// Resend(https://resend.com) API를 통해 백업 파일을 이메일로 전송.
// RESEND_API_KEY 환경변수가 없으면 에러를 던짐 (서버에서만 사용, 클라이언트에 키 노출 안 됨).

const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'Cal2do <onboarding@resend.dev>';

export async function sendBackupEmail(toEmail: string, backupJson: string, filename: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY 환경변수가 설정되지 않았습니다.');
  if (!toEmail) throw new Error('받는 사람 이메일 주소를 확인할 수 없습니다.');

  const attachmentBase64 = Buffer.from(backupJson, 'utf-8').toString('base64');
  const today = new Date().toLocaleDateString('ko-KR');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [toEmail],
      subject: `Cal2do 백업 (${today})`,
      html: `<p>Cal2do 전체 백업 파일이에요.</p><p>첨부된 <b>${filename}</b> 파일을 보관해두시면, 앱의 "가져오기 / 내보내기 → 전체 백업 가져오기"에서 그대로 복원할 수 있어요.</p>`,
      attachments: [{ filename, content: attachmentBase64 }],
    }),
  });

  if (!res.ok) {
    let message = `이메일 발송 실패 (${res.status})`;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {}
    throw new Error(message);
  }

  return res.json();
}
