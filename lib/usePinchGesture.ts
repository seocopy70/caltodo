import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

// 두 손가락 벌리기/좁히기 감지. 브라우저 기본 확대/축소(pinch-zoom)는 전역 CSS(touch-action: pan-x pan-y)로
// 막혀 있고, 이 훅은 "지정한 영역 안에서" 시작된 두 손가락 제스처만 골라 콜백으로 알려준다.
// 한 번의 제스처(두 손가락이 닿아있는 동안)에서 한 번만 발동해서 토글이 깜빡이지 않게 한다.
const SPREAD_RATIO = 1.25; // 처음 간격의 1.25배 이상 벌어지면 "벌리기"
const PINCH_RATIO = 0.8; // 처음 간격의 0.8배 이하로 좁아지면 "좁히기"
const MIN_START_DIST = 30; // 두 손가락이 너무 붙어서 시작하면(오터치) 비율이 불안정하므로 무시

export function usePinchGesture(
  ref: RefObject<HTMLElement>,
  handlers: { onSpread?: () => void; onPinch?: () => void }
) {
  // 콜백은 매 렌더마다 바뀔 수 있으므로 ref로 최신값만 참조(이벤트 리스너는 한 번만 등록)
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let startDist = 0;
    let fired = false;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = dist(e.touches);
        fired = false;
      } else {
        startDist = 0; // 세 손가락 이상이거나 한 손가락이면 제스처 아님
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || startDist < MIN_START_DIST || fired) return;
      const ratio = dist(e.touches) / startDist;
      if (ratio >= SPREAD_RATIO) { fired = true; handlersRef.current.onSpread?.(); }
      else if (ratio <= PINCH_RATIO) { fired = true; handlersRef.current.onPinch?.(); }
    };
    const onEnd = (e: TouchEvent) => { if (e.touches.length < 2) { startDist = 0; fired = false; } };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [ref]);
}
