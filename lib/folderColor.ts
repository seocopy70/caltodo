// 폴더마다 시각적으로 구분되는 색을 일관되게 배정하기 위한 helper.
// 폴더 id를 해시해서 팔레트에서 하나를 고르므로, 별도 색상 저장 없이도 항상 같은 폴더는 같은 색으로 보임.

const PALETTE = [
  { text: 'text-rose-500 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/15', activeBg: 'bg-rose-500' },
  { text: 'text-orange-500 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-500/15', activeBg: 'bg-orange-500' },
  { text: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/15', activeBg: 'bg-amber-500' },
  { text: 'text-lime-600 dark:text-lime-400', bg: 'bg-lime-100 dark:bg-lime-500/15', activeBg: 'bg-lime-500' },
  { text: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/15', activeBg: 'bg-emerald-500' },
  { text: 'text-teal-500 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-500/15', activeBg: 'bg-teal-500' },
  { text: 'text-sky-500 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-500/15', activeBg: 'bg-sky-500' },
  { text: 'text-indigo-500 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-500/15', activeBg: 'bg-indigo-500' },
  { text: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-500/15', activeBg: 'bg-violet-500' },
  { text: 'text-pink-500 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-500/15', activeBg: 'bg-pink-500' },
];

const DEFAULT_COLOR = { text: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/15', activeBg: 'bg-amber-500' };

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** 폴더 id로 항상 같은 색을 반환 (없으면 기본 amber) */
export function getFolderColor(folderId?: string | null) {
  if (!folderId) return DEFAULT_COLOR;
  return PALETTE[hashString(folderId) % PALETTE.length];
}
