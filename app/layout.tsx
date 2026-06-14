import type { ReactNode } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { SiteNav } from '@/components/SiteNav';
import { JsonLd } from '@/components/JsonLd';
import { websiteJsonLd, organizationJsonLd } from '@/lib/seo';
import './globals.css';

export const metadata = {
  metadataBase: new URL('https://narrative-broadcast.com'),
  title: {
    default: 'Narrative Broadcast - 市場参加者の物語と認知を構造分析するナラティブ観測メディア',
    template: '%s | Narrative Broadcast',
  },
  description:
    '市場参加者の物語と認知を構造分析するナラティブ観測メディア',
  verification: {
    google: 'rq4tjRcaq_uRdmhi4vYFxtUe3kkE31-7VkYVushrnCU',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Murecho:wght@400;500;600;700&family=Zen+Kaku+Gothic+New:wght@500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <JsonLd data={[websiteJsonLd(), organizationJsonLd()]} />
        <header className="masthead">
          <div className="masthead-inner">
            <a href="/" className="wordmark">
              <span className="wordmark-text">
                Narrative Broadcast
              </span>
            </a>
            <SiteNav />
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
        <Analytics />
      </body>
    </html>
  );
}
