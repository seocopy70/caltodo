'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api-client';
import { X, Mail, Send } from 'lucide-react';

const FREQUENCY_LABEL: Record<string, string> = { off: '사용 안 함', daily: '매일', weekly: '매주', monthly: '매월' };

export default function EmailBackupPanel({ user, onClose, onNotify }: any) {
  const [frequency, setFrequency] = useState('off');
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [sendingNow, setSendingNow] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const notify = onNotify || (() => {});

  useEffect(() => {
    api.backup.getSettings()
      .then((res: any) => { setFrequency(res.frequency || 'off'); setLastSentAt(res.lastSentAt); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const changeFrequency = (value: string) => {
    setFrequency(value);
    api.backup.updateSettings(value)
      .then(() => notify(value === 'off' ? '자동 백업을 껐어요.' : `${FREQUENCY_LABEL[value]} 자동으로 이메일 백업을 보낼게요.`))
      .catch((err: any) => notify(`설정 저장 실패: ${err.message || err}`, 'error'));
  };

  const sendBackupEmailNow = async () => {
    setSendingNow(true);
    try {
      const res = await api.backup.sendNow();
      notify(`${res.sentTo}로 백업을 보냈어요.`);
      setLastSentAt(new Date().toISOString());
    } catch (err: any) {
      notify(`이메일 발송 실패: ${err.message || err}`, 'error');
    } finally {
      setSendingNow(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2"><Mail className="w-5 h-5 text-blue-500 dark:text-blue-400" /> 이메일 백업</h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X /></button>
          </div>
          <p className="text-xs text-slate-500">로그인에 사용한 구글 이메일({user?.email || '로그인 계정'})로 전체 백업(.json)을 보내드려요.</p>

          <button onClick={sendBackupEmailNow} disabled={sendingNow} className="w-full flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl disabled:opacity-60">
            <Send className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            <div className="text-left">
              <p className="font-bold text-sm text-slate-900 dark:text-white">{sendingNow ? '보내는 중...' : '지금 이메일로 백업 보내기'}</p>
              {lastSentAt && <p className="text-[11px] text-slate-500">마지막 발송: {new Date(lastSentAt).toLocaleString('ko-KR')}</p>}
            </div>
          </button>

          <div>
            <p className="text-xs font-bold text-slate-500 mb-1.5">자동 백업 주기</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(['off', 'daily', 'weekly', 'monthly'] as const).map((f) => (
                <button key={f} onClick={() => changeFrequency(f)} disabled={!loaded} className={`py-2 rounded-xl text-xs font-bold ${frequency === f ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{FREQUENCY_LABEL[f]}</button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">구글 계정 용량 등 문제로 이메일 발송이 실패하면 다음 접속 시 알려드릴게요.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
