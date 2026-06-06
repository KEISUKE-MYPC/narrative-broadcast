import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'BTCナラティブ分析',
  description:
    'Bitcoinのナラティブ（市場参加者の認知・物語）を6時間ごとに構造分析する、観測者の夜報。',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Murecho:wght@400;500;600;700&family=Shippori+Mincho:wght@500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="page">
          <header className="site-header">
            <a href="/" className="wordmark">
              <span className="wordmark-mark">観</span>
              <span className="wordmark-text">
                BTCナラティブ分析
                <span className="wordmark-sub">観測者の夜報</span>
              </span>
            </a>
            <nav className="site-nav">
              <a href="/archive">アーカイブ</a>
            </nav>
          </header>
          <main className="site-main">{children}</main>
          <footer className="site-footer">
            <p className="disclaimer">
              本サイトは情報提供を目的としたものであり、投資助言ではありません。価格予想・売買助言ではなく、ナラティブ（認知）の構造分析です。
            </p>
            <p className="colophon">
              6時間ごとに自動生成・公開。データ：CoinGecko / Glassnode / Santiment / Coinalyze / Polymarket / DefiLlama。
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
