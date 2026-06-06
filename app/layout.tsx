import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'BTCナラティブ分析',
  description:
    'Bitcoinのナラティブ（市場参加者の認知・物語）を6時間ごとに構造分析するサイト',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="site-header">
          <a href="/" className="site-title">BTCナラティブ分析</a>
          <nav><a href="/archive">アーカイブ</a></nav>
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          ※本サイトは情報提供を目的としたものであり、投資助言ではありません。
        </footer>
      </body>
    </html>
  );
}
