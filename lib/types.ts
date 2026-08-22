export type ColorKey = 'blue' | 'green' | 'amber' | 'rose' | 'violet' | 'cyan';

export const COLOR_OPTIONS: { key: ColorKey; label: string; dot: string; bg: string; text: string; border: string }[] = [
  { key: 'blue', label: 'Blue', dot: 'bg-blue-500', bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30' },
  { key: 'green', label: 'Green', dot: 'bg-emerald-500', bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  { key: 'amber', label: 'Amber', dot: 'bg-amber-500', bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' },
  { key: 'rose', label: 'Rose', dot: 'bg-rose-500', bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/30' },
  { key: 'violet', label: 'Violet', dot: 'bg-violet-500', bg: 'bg-violet-500/15', text: 'text-violet-300', border: 'border-violet-500/30' },
  { key: 'cyan', label: 'Cyan', dot: 'bg-cyan-500', bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'border-cyan-500/30' },
];

export function getColorClasses(color: string) {
  return COLOR_OPTIONS.find((c) => c.key === color) || COLOR_OPTIONS[0];
}
