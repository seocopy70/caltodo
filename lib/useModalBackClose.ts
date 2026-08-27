'use client';

import { useEffect, useRef } from 'react';

/**
 * 모달/입력창이 열려있는 동안 뒤로가기(브라우저 back, 모바일 스와이프 제스처)를 누르면
 * 앱을 나가는 대신 이 모달만 닫히도록 한다.
 *
 * 사용법: 모달 컴포넌트 최상단에서 useModalBackClose(onClose) 호출.
 */
export function useModalBackClose(onClose: () => void) {
  const closedByBackRef = useRef(false);

  useEffect(() => {
    window.history.pushState({ __modal: true }, '');
    const handlePopState = () => {
      closedByBackRef.current = true;
      onClose();
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      // X 버튼 등으로 닫힌 경우(뒤로가기로 닫힌 게 아니라면) 방금 추가해둔 히스토리 항목을 정리
      if (!closedByBackRef.current) {
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
