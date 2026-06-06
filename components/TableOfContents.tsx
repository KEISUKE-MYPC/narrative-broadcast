'use client';
import { useEffect, useState } from 'react';
import type { TocItem } from '@/lib/markdown';

export function TableOfContents({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? '');

  useEffect(() => {
    const targets = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-72px 0px -68% 0px', threshold: 0 }
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 2) return null;

  return (
    <aside className="toc" aria-label="目次">
      <p className="toc-title">目次</p>
      <nav>
        <ul>
          {items.map((i) => (
            <li
              key={i.id}
              className={`toc-${i.depth}${active === i.id ? ' active' : ''}`}
            >
              <a href={`#${i.id}`}>{i.text}</a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
