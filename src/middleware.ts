import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // 데모 페이지는 인증 없이 바로 통과 (Supabase 클라이언트 생성 전에 체크)
  if (request.nextUrl.pathname.startsWith('/demo')) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: DO NOT REMOVE auth.getUser()
  // This refreshes the session if expired - required for Server Components
  let user = null;
  let authErrorMessage: string | null = null;

  try {
    const { data, error } = await supabase.auth.getUser();
    user = data?.user ?? null;
    if (error) {
      authErrorMessage = error.message;
    }
  } catch (error) {
    console.error('Middleware auth error:', error);
    authErrorMessage = error instanceof Error ? error.message : 'Unknown auth error';
  }

  // Refresh Token 에러 처리
  if (authErrorMessage) {
    const isRefreshTokenError =
      authErrorMessage.includes('Refresh Token') ||
      authErrorMessage.includes('refresh_token') ||
      authErrorMessage.includes('Invalid Refresh Token') ||
      authErrorMessage.includes('JWT expired');

    if (isRefreshTokenError) {
      // 인증 쿠키 삭제
      const authCookieNames = ['sb-access-token', 'sb-refresh-token'];
      request.cookies.getAll().forEach(cookie => {
        if (cookie.name.includes('supabase') || authCookieNames.includes(cookie.name)) {
          supabaseResponse.cookies.delete(cookie.name);
        }
      });

      // 보호된 페이지인 경우 로그인으로 리다이렉트
      const isAuthPage = request.nextUrl.pathname.startsWith('/login') ||
                         request.nextUrl.pathname.startsWith('/signup');
      const isPublicPage = request.nextUrl.pathname === '/';

      if (!isAuthPage && !isPublicPage) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('error', 'session_expired');
        return NextResponse.redirect(url);
      }
    }
  }

  // 로그인 페이지나 회원가입 페이지가 아닌 경우 인증 체크
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') ||
                     request.nextUrl.pathname.startsWith('/signup');
  const isPublicPage = request.nextUrl.pathname === '/';
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');
  const isDemoPage = request.nextUrl.pathname.startsWith('/demo');

  // API 라우트, 공개 페이지, 데모 페이지는 그대로 통과
  if (isApiRoute || isPublicPage || isDemoPage) {
    return supabaseResponse;
  }

  // 로그인하지 않은 사용자가 보호된 페이지 접근 시 로그인으로 리다이렉트
  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 로그인한 사용자 처리
  if (user) {
    const role = user.user_metadata?.role;

    if (role) {
      const pathname = request.nextUrl.pathname;

      // 1. 로그인/회원가입 페이지 접근 시 본인 대시보드로 리다이렉트
      if (isAuthPage) {
        const url = request.nextUrl.clone();
        if (role === 'super_admin') url.pathname = '/super-admin';
        else if (role === 'teacher') url.pathname = '/teacher';
        else if (role === 'parent') url.pathname = '/parent';
        else if (role === 'student') url.pathname = '/student';
        else url.pathname = '/';
        return NextResponse.redirect(url);
      }

      // 2. 역할별 경로 보호 (RBAC)
      if (pathname.startsWith('/super-admin') && role !== 'super_admin') {
        const url = request.nextUrl.clone();
        url.pathname = role === 'teacher' ? '/teacher' : role === 'parent' ? '/parent' : '/student';
        return NextResponse.redirect(url);
      }
      if (pathname.startsWith('/teacher') && role !== 'teacher' && role !== 'super_admin') {
        const url = request.nextUrl.clone();
        url.pathname = role === 'super_admin' ? '/super-admin' : role === 'parent' ? '/parent' : '/student';
        return NextResponse.redirect(url);
      }
      if (pathname.startsWith('/parent') && role !== 'parent') {
        const url = request.nextUrl.clone();
        url.pathname = role === 'super_admin' ? '/super-admin' : role === 'teacher' ? '/teacher' : '/student';
        return NextResponse.redirect(url);
      }
      if (pathname.startsWith('/student') && role !== 'student') {
        const url = request.nextUrl.clone();
        url.pathname = role === 'super_admin' ? '/super-admin' : role === 'teacher' ? '/teacher' : '/parent';
        return NextResponse.redirect(url);
      }
    }
  }
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
