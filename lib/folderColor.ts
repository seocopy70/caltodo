// 폴더마다 시각적으로 구분되는 색을 배정하기 위한 helper.
// 사용자가 직접 고른 색(folder.color, 팔레트 키 문자열)이 있으면 그걸 최우선으로 쓰고,
// 아직 고르지 않은(기존) 폴더는 예전처럼 폴더 id를 해시해서 항상 같은 색으로 보이게 한다.

export const PALETTE_KEYS = ['rose', 'orange', 'amber', 'lime', 'emerald', 'teal', 'sky', 'indigo', 'violet', 'pink'] as const;
export type FolderColorKey = typeof PALETTE_KEYS[number];

const PALETTE_BY_KEY: Record<FolderColorKey, { text: string; bg: string; activeBg: string; dot: string }> = {
  rose: { text: 'text-rose-500 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/15', activeBg: 'bg-rose-500', dot: 'bg-rose-500' },
  orange: { text: 'text-orange-500 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-500/15', activeBg: 'bg-orange-500', dot: 'bg-orange-500' },
  amber: { text: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/15', activeBg: 'bg-amber-500', dot: 'bg-amber-500' },
  lime: { text: 'text-lime-600 dark:text-lime-400', bg: 'bg-lime-100 dark:bg-lime-500/15', activeBg: 'bg-lime-500', dot: 'bg-lime-500' },
  emerald: { text: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/15', activeBg: 'bg-emerald-500', dot: 'bg-emerald-500' },
  teal: { text: 'text-teal-500 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-500/15', activeBg: 'bg-teal-500', dot: 'bg-teal-500' },
  sky: { text: 'text-sky-500 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-500/15', activeBg: 'bg-sky-500', dot: 'bg-sky-500' },
  indigo: { text: 'text-indigo-500 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-500/15', activeBg: 'bg-indigo-500', dot: 'bg-indigo-500' },
  violet: { text: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-500/15', activeBg: 'bg-violet-500', dot: 'bg-violet-500' },
  pink: { text: 'text-pink-500 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-500/15', activeBg: 'bg-pink-500', dot: 'bg-pink-500' },
};

// 배열 형태(기존 해시 배정용 순서)도 그대로 유지
const PALETTE = PALETTE_KEYS.map((k) => PALETTE_BY_KEY[k]);

const DEFAULT_COLOR = PALETTE_BY_KEY.amber;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** 팔레트 키(예: 'rose')로 바로 색상 클래스를 가져올 때 사용(색깔원 미리보기 등) */
export function getColorByKey(key: string) {
  return (PALETTE_BY_KEY as any)[key] || DEFAULT_COLOR;
}

/**
 * 폴더 id로 색을 가져온다. folders 목록을 같이 넘기면 그 폴더의 저장된 color(사용자가 고른 값)를
 * 최우선으로 사용하고, 없으면 예전처럼 id 해시로 항상 같은 색을 배정한다.
 */
export function getFolderColor(folderId?: string | null, folders?: Array<{ id: string; color?: string | null }> | null) {
  if (!folderId) return DEFAULT_COLOR;
  const folder = folders?.find((f) => f.id === folderId);
  if (folder?.color && (PALETTE_BY_KEY as any)[folder.color]) return (PALETTE_BY_KEY as any)[folder.color];
  return PALETTE[hashString(folderId) % PALETTE.length];
}
