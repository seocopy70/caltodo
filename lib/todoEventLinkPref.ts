// 할일에 날짜를 설정할 때 "일정으로도 저장할까요?"를 매번 물어볼지 정하는 사용자 선택.
// 'ask'(기본, 매번 물어봄) | 'always'(항상 일정 연동) | 'never'(항상 연동 안 함)
// TodoModal(입력창에서 처음 물어볼 때)과 메인메뉴의 설정 화면이 이 키를 함께 씀.
export const TODO_EVENT_LINK_PREF_KEY = 'cal2do-todo-event-link-pref';

export type TodoEventLinkPref = 'ask' | 'always' | 'never';

export function getTodoEventLinkPref(): TodoEventLinkPref {
  if (typeof window === 'undefined') return 'ask';
  const v = window.localStorage.getItem(TODO_EVENT_LINK_PREF_KEY);
  return v === 'always' || v === 'never' ? v : 'ask';
}

export function setTodoEventLinkPref(pref: TodoEventLinkPref) {
  if (typeof window === 'undefined') return;
  if (pref === 'ask') window.localStorage.removeItem(TODO_EVENT_LINK_PREF_KEY);
  else window.localStorage.setItem(TODO_EVENT_LINK_PREF_KEY, pref);
}
