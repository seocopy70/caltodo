/**
 * 할일에 기한을 설정하면 얼마나 급한지에 따라 우선순위(색깔원)를 자동으로 골라준다.
 * 5일 이내: 빨강(긴급), 한 달 이내: 노랑(보통), 그 외(또는 이미 지난 기한 포함 5일 초과): 초록(여유).
 * 지난 기한은 이미 지났으므로 가장 급한 빨강으로 처리.
 */
export function autoPriorityForDueDate(dueDateStr: string | null | undefined): 'red' | 'yellow' | 'green' | null {
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  const diffDays = Math.round(
    (new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000
  );
  if (diffDays <= 5) return 'red';
  if (diffDays <= 30) return 'yellow';
  return 'green';
}
