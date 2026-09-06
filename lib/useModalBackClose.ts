'use client';

import { useEffect, useRef } from 'react';

// 현재 이 훅으로 열려있는 모달 인스턴스 개수. 앱 전체에서 "지금 열려있는 모달이 하나라도 있는가"를
// 판단하는 용도로 재사용한다(스와이프 제스처 가드 등에서 사용).
let openModalCount = 0;
export function isAnyModalOpen() {
  return openModalCount > 0;
}

// pushState는 몇 번 했는데 아직 그만큼 정리(back)를 못 한 상태인지 추적.
// 평소엔 openModalCount와 같아야 정상이고, 모달이 X버튼 등으로 닫힐 때만 잠깐 어긋났다가
// 아래 scheduleHistoryCleanup에서 한 틱 뒤에 정확히 맞춰준다.
let pushedDepth = 0;
let cleanupScheduled = false;

// history.back()을 여러 번 나눠서 부르면 그때마다 비동기 popstate가 하나씩 날아오는데,
// "이 모달을 닫으면서 같은 틱에 다른 모달이 새로 열리는 경우"(예: 메모 보기→수정으로 바로 전환)나
// "여러 모달이 한꺼번에 같이 닫히는 경우"(예: 메인메뉴+그 안에서 연 모달을 함께 닫기)에는 그
// popstate가 이미 사라지고 없는 리스너를 향하거나, 엉뚱한 다른 모달의 리스너에 잘못 전달돼
// 방금 연 모달이 곧바로 닫혀버리는 문제가 있었다. 그래서 개별 back() 호출 대신, 한 틱(microtask)
// 안에서 일어난 모든 "열기/닫기"를 다 지켜본 뒤 순변화량만큼 딱 한 번 history.go(-n)으로 정리한다.
function scheduleHistoryCleanup() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  queueMicrotask(() => {
    cleanupScheduled = false;
    const stale = pushedDepth - openModalCount;
    if (stale > 0) {
      pushedDepth -= stale;
      window.history.go(-stale);
    }
  });
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
    pushedDepth += 1;
    window.history.pushState({ __modal: true }, '');
    const handlePopState = () => {
      closedByBackRef.current = true;
      onClose();
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      openModalCount -= 1;
      if (closedByBackRef.current) {
        // 실제 뒤로가기로 닫힌 경우엔 브라우저가 이미 히스토리를 한 칸 옮겨준 뒤라, 우리가
        // 또 back()을 부를 필요는 없고 장부(pushedDepth)만 맞춰준다.
        pushedDepth -= 1;
      } else {
        // X 버튼/저장 등으로 닫힌 경우: 지금 당장 back()을 부르지 않고, 같은 틱에 다른 모달이
        // 새로 열리거나 함께 닫히는 것까지 다 반영된 뒤(microtask) 순변화량만큼만 한 번에 정리.
        scheduleHistoryCleanup();
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
