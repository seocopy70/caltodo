import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '내 캘린더',
  description: '갤럭시 폰과 PC에서 동기화되는 나만의 캘린더',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var stored = localStorage.getItem('calendar-theme');
            var theme = stored === 'light' ? 'light' : 'dark';
            if (theme === 'dark') document.documentElement.classList.add('dark');
          })();
        `}} />
      </head>
      <body className={`${inter.className} bg-background text-foreground antialiased`}>{children}</body>
    </html>
  );
}
