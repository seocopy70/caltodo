'use client';

import { useState } from 'react';
import { X, Lock, ShieldCheck, Mail, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api-client';
import { useModalBackClose } from '../../lib/useModalBackClose';
import { PinInput, PatternInput } from './NoteLockPad';

type Mode = 'setup' | 'unlock' | 'disable';

export default function SecureFolderModal({ folder, mode, onClose, onSuccess, onNotify }: any) {
  useModalBackClose(onClose);
  const notify = onNotify || (() => {});
  const [step, setStep] = useState<'main' | 'forgot-sent' | 'forgot-confirm'>('main');
  const [lockType, setLockType] = useState<'pin' | 'pattern'>('pin');
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [locked, setLocked] = useState(!!folder?.isLocked);
  const [sentTo, setSentTo] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [busy, setBusy] = useState(false);

  const title = mode === 'setup' ? '보안폴더 만들기' : mode === 'disable' ? '보안폴더 해제' : '보안폴더';

  // 최초 지정: PIN/패턴 설정
  const handleSetup = (code: string) => {
    setBusy(true);
    api.noteFolders.setupSecure(folder.id, lockType, code)
      .then(() => { notify('보안폴더로 지정했어요.'); onSuccess?.(); })
      .catch((err: any) => { setError(err.message || String(err)); setBusy(false); });
  };

  // 잠금 해제 시도
  const handleVerify = (code: string) => {
    setBusy(true);
    setError('');
    api.noteFolders.verifySecure(folder.id, code)
      .then((res: any) => {
        if (res.ok) { onSuccess?.(); return; }
        if (res.locked) { setLocked(true); setError('5회 이상 틀려서 잠겼어요. 이메일로 복구해주세요.'); }
        else { setRemaining(res.remaining); setError(`맞지 않아요. ${res.remaining}번 더 틀리면 잠겨요.`); }
        setBusy(false);
      })
      .catch((err: any) => { setError(err.message || String(err)); setBusy(false); });
  };

  // 보안폴더 해제(현재 코드 재확인)
  const handleDisable = (code: string) => {
    setBusy(true);
    api.noteFolders.unsecure(folder.id, code)
      .then(() => { notify('보안폴더를 해제했어요.'); onSuccess?.(); })
      .catch((err: any) => { setError(err.message || String(err)); setBusy(false); });
  };

  // 비밀번호 찾기: 이메일로 인증코드 요청
  const requestReset = () => {
    setBusy(true);
    api.noteFolders.requestSecureReset(folder.id)
      .then((res: any) => { setSentTo(res.sentTo); setStep('forgot-sent'); setBusy(false); })
      .catch((err: any) => { setError(err.message || String(err)); setBusy(false); });
  };

  // 인증코드 확인 + 새 PIN/패턴 설정
  const confirmReset = (newCode: string) => {
    setBusy(true);
    api.noteFolders.confirmSecureReset(folder.id, resetCode, lockType, newCode)
      .then(() => { notify('새 비밀번호/패턴으로 재설정됐어요.'); onSuccess?.(); })
      .catch((err: any) => { setError(err.message || String(err)); setBusy(false); });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-blue-500" /> {title}</h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X /></button>
          </div>

          {mode === 'setup' && step === 'main' && (
            <>
              <p className="text-sm text-slate-500">이 폴더에 넣은 메모는 PIN 또는 패턴을 입력해야 볼 수 있어요. 별표(오늘 탭 표시)는 사용할 수 없어요.</p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setLockType('pin')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${lockType === 'pin' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>PIN 번호</button>
                <button onClick={() => setLockType('pattern')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${lockType === 'pattern' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>패턴</button>
              </div>
              {lockType === 'pin' ? <PinInput label="새 PIN 번호를 입력하세요" onSubmit={handleSetup} submitLabel="설정 완료" /> : <PatternInput label="새 패턴을 그려주세요" onSubmit={handleSetup} submitLabel="설정 완료" />}
            </>
          )}

          {mode === 'unlock' && step === 'main' && !locked && (
            <>
              <p className="text-sm text-slate-500">{folder.lockType === 'pattern' ? '패턴을 그려서 잠금을 해제하세요.' : 'PIN 번호를 입력해서 잠금을 해제하세요.'}</p>
              {folder.lockType === 'pattern' ? <PatternInput onSubmit={handleVerify} submitLabel="해제" /> : <PinInput onSubmit={handleVerify} submitLabel="해제" />}
            </>
          )}

          {mode === 'unlock' && locked && step === 'main' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-rose-500 bg-rose-50 dark:bg-rose-500/10 p-3 rounded-2xl text-sm"><AlertTriangle className="w-4 h-4 shrink-0" /> 5회 이상 틀려서 이 폴더가 잠겼어요.</div>
              <button disabled={busy} onClick={requestReset} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm disabled:opacity-50"><Mail className="w-4 h-4" /> 이메일로 인증코드 받기</button>
            </div>
          )}

          {step === 'forgot-sent' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">{sentTo}로 인증코드를 보냈어요. 15분간 유효합니다.</p>
              <input
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={6}
                inputMode="numeric"
                placeholder="6자리 인증코드"
                className="w-full text-center tracking-[0.5em] text-lg bg-slate-100 dark:bg-slate-800 rounded-xl py-3 outline-none"
              />
              <button disabled={resetCode.length < 6} onClick={() => setStep('forgot-confirm')} className="w-full py-3 bg-blue-600 disabled:opacity-40 text-white rounded-2xl font-bold text-sm">다음</button>
              <button disabled={busy} onClick={requestReset} className="w-full text-xs font-bold text-slate-500">코드 다시 받기</button>
            </div>
          )}

          {step === 'forgot-confirm' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">새로 사용할 PIN 또는 패턴을 설정하세요.</p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setLockType('pin')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${lockType === 'pin' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>PIN 번호</button>
                <button onClick={() => setLockType('pattern')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${lockType === 'pattern' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>패턴</button>
              </div>
              {lockType === 'pin' ? <PinInput label="새 PIN 번호" onSubmit={confirmReset} submitLabel="재설정 완료" /> : <PatternInput label="새 패턴" onSubmit={confirmReset} submitLabel="재설정 완료" />}
            </div>
          )}

          {mode === 'disable' && (
            <>
              <p className="text-sm text-slate-500">보안폴더를 해제하려면 현재 {folder.lockType === 'pattern' ? '패턴' : 'PIN'}을 입력하세요.</p>
              {folder.lockType === 'pattern' ? <PatternInput onSubmit={handleDisable} submitLabel="해제하기" /> : <PinInput onSubmit={handleDisable} submitLabel="해제하기" />}
            </>
          )}

          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}
