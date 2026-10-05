import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Lightweight edge gate: redirect unauthenticated users away from /app and
 * /admin. Full auth (session validation) happens in the route/page via
 * getCurrentUser; this just avoids rendering protected shells for users with
 * no session cookie at all.
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has('ap_session');
  const { pathname } = req.nextUrl;
  if ((pathname.startsWith('/app') || pathname.startsWith('/admin')) && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/admin/:path*'],
};
