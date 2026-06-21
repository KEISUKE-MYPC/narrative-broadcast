'use client';
import { usePathname } from 'next/navigation';
import { CATEGORIES } from '@/lib/categories';
import { topicHubUrl } from '@/lib/urls';

// 分野ナビ。分野が2つ以上になったら表示する（1つの間はスカスカ回避で非表示）。
export function SiteNav() {
  const pathname = usePathname();
  if (CATEGORIES.length <= 1) return null;

  return (
    <nav className="site-nav" aria-label="分野">
      <div className="site-nav-inner">
        {CATEGORIES.map((c) => {
          const href = topicHubUrl(c.slug);
          const active = pathname?.startsWith(href);
          return (
            <a
              key={c.slug}
              href={href}
              className={active ? 'is-active' : undefined}
              aria-current={active ? 'page' : undefined}
            >
              {c.short}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
