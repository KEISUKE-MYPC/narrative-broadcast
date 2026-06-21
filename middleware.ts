import { NextResponse, type NextRequest } from 'next/server';
import { legacyRedirect } from '@/lib/redirects';

export function middleware(req: NextRequest) {
  const dest = legacyRedirect(req.nextUrl.pathname);
  if (dest) {
    const url = req.nextUrl.clone();
    url.pathname = dest;
    return NextResponse.redirect(url, 301);
  }
  return NextResponse.next();
}

// 旧URLだけを対象にする（新URL・静的アセットには干渉しない）
export const config = {
  matcher: ['/articles/:path*', '/c/:path*'],
};
