import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cal2do - 캘린더 & 할 일',
    short_name: 'Cal2do',
    description: '갤럭시 폰과 PC에서 동기화되는 나만의 캘린더 & 할 일 앱',
    start_url: '/',
    display: 'standalone',
    // 'portrait'로 고정되어 있으면 설치된 PWA에서 기기를 가로로 돌려도 화면이 따라 돌지 않음 — 자유롭게 허용.
    orientation: 'any',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
