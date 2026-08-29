'use client';

import { useEffect, useRef } from 'react';

// 현재 이 훅으로 열려있는 모달 인스턴스 개수. 모달을 닫으면서(예: 메모 "보기" 모달을 닫고)
// 같은 렌더 배치 안에서 곧바로 다른 모달을 여는 경우(예: 메모 "수정" 모달)를 감지하기 위해 사용.
// 앱 전체에서 "지금 열려있는 모달이 하나라도 있는가"를 판단하는 용도로도 재사용한다(중앙 뒤로가기 핸들러 참고).
let openModalCount = 0;
export function isAnyModalOpen() {
  return openModalCount > 0;
}

// 모달이 X버튼/저장 등으로 닫히면서 정리 차원에서 프로그램적으로 history.back()을 호출할 때가 있는데,
// 이때 뒤늦게 도착하는 popstate는 "사용자가 진짜로 뒤로가기를 누른 것"이 아니라 내부 정리용 이벤트다.
// 중앙 뒤로가기 핸들러(app/page.tsx)가 이를 실제 사용자 동작으로 오인해서 탭 전환/입력창 닫기 등을
// 실행해버리지 않도록, 그 popstate 하나를 "무시해야 함"으로 표시해둔다.
let pendingProgrammaticPop = false;
export function markProgrammaticPop() {
  pendingProgrammaticPop = true;
}
export function consumeProgrammaticPop(): boolean {
  if (pendingProgrammaticPop) {
    pendingProgrammaticPop = false;
    return true;
  }
  return false;
}

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
            markProgrammaticPop();
            window.history.back();
          }
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * useModalBackClose를 컴포넌트 형태로 감싼 버전. 큰 모달 컴포넌트가 아니라
 * 작은 드롭다운/메뉴(메인메뉴, 폴더 선택 팝오버 등)를 조건부로 렌더링할 때,
 * 그 옆에 같이 렌더링해서 "열려있는 동안만" 뒤로가기 추적을 붙이는 용도.
 *
 * 사용법: {open && <><ModalBackCloseGuard onClose={...} /> ...나머지 UI... </>}
 */
export function ModalBackCloseGuard({ onClose }: { onClose: () => void }) {
  useModalBackClose(onClose);
  return null;
}
