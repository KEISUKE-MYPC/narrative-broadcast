import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'BTCナラティブ分析',
  description:
    'Bitcoinのナラティブ（市場参加者の認知・物語）を6時間ごとに構造分析する読み物。',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Murecho:wght@400;500;600;700&family=Zen+Kaku+Gothic+New:wght@500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="masthead">
          <div className="masthead-inner">
            <a href="/" className="wordmark">
              <span className="wordmark-text">
                narrative-broadcast
              </span>
            </a>
          </div>
        </header>

        <main className="page-main">{children}</main>

        <footer className="page-foot">
          <div className="foot-inner">
            <p className="disclaimer">
              本サイトは情報提供を目的としたものであり、投資助言ではありません。価格予想・売買助言ではなく、ナラティブ（認知）の構造分析です。
            </p>
            <p className="colophon">
              データ：CoinGecko / Glassnode / Santiment / Coinalyze / Polymarket / DefiLlama
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
