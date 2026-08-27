'use client';

import { useEffect, useRef } from 'react';

// 현재 이 훅으로 열려있는 모달 인스턴스 개수. 모달을 닫으면서(예: 메모 "보기" 모달을 닫고)
// 같은 렌더 배치 안에서 곧바로 다른 모달을 여는 경우(예: 메모 "수정" 모달)를 감지하기 위해 사용.
let openModalCount = 0;

/**
 * 모달/입력창이 열려있는 동안 뒤로가기(브라우저 back, 모바일 스와이프 제스처)를 누르면
 * 앱을 나가는 대신 이 모달만 닫히도록 한다.
 *
 * 사용법: 모달 컴포넌트 최상단에서 useModalBackClose(onClose) 호출.
 */
export function useModalBackClose(onClose: () => void) {
  const closedByBackRef = useRef(false);

  useEffect(() => {
    openModalCount += 1;
    window.history.pushState({ __modal: true }, '');
    const handlePopState = () => {
      closedByBackRef.current = true;
      onClose();
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      openModalCount -= 1;
      // X 버튼 등으로 닫힌 경우(뒤로가기로 닫힌 게 아니라면) 방금 추가해둔 히스토리 항목을 정리.
      //
      // 주의: history.back()은 비동기라서, 이 모달을 닫으면서 "같은 순간" 다른 모달을 새로 여는 경우
      // (예: 메모 보기 모달을 닫고 곧바로 수정 모달을 여는 흐름) back()이 실제로 처리되기 전에
      // 새 모달이 pushState를 먼저 해버릴 수 있다. 그러면 뒤늦게 도착한 popstate가 새 모달의
      // 리스너에 전달되어 방금 연 모달이 즉시 닫혀버리는 문제가 생긴다.
      // 이를 막기 위해 back() 호출을 다음 microtask로 미루고, 그 사이에 다른 모달이 새로 열려
      // openModalCount가 원래대로 돌아왔다면(=이 모달이 진짜 "마지막"이 아니었다면) back()을 건너뛴다.
      if (!closedByBackRef.current) {
        const countAtClose = openModalCount;
        queueMicrotask(() => {
          if (openModalCount === countAtClose) {
            window.history.back();
          }
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
