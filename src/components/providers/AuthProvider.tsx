'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User as SupabaseUser, AuthError } from '@supabase/supabase-js';

interface AuthContextType {
  user: SupabaseUser | null;
  loading: boolean;
  error: AuthError | null;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  signOut: async () => {},
  clearError: () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

// 인증이 필요 없는 공개 경로
const PUBLIC_PATHS = ['/', '/login', '/signup'];

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleAuthError = useCallback((authError: AuthError) => {
    console.error('Auth error:', authError.message);
    setError(authError);

    // Refresh Token 관련 에러 처리
    const isRefreshTokenError =
      authError.message.includes('Refresh Token') ||
      authError.message.includes('refresh_token') ||
      authError.message.includes('Invalid Refresh Token') ||
      authError.message.includes('JWT expired') ||
      authError.code === 'refresh_token_not_found';

    if (isRefreshTokenError) {
      // 세션 정리 및 로그인 페이지로 리다이렉트
      const supabase = createClient();
      supabase.auth.signOut().then(() => {
        setUser(null);
        // 공개 페이지가 아닌 경우에만 리다이렉트
        if (!PUBLIC_PATHS.includes(pathname)) {
          router.push('/login?error=session_expired');
        }
      });
    }
  }, [pathname, router]);

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setUser(null);
      router.push('/login');
    } catch (err) {
      console.error('Sign out error:', err);
      // 강제로 세션 정리
      setUser(null);
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    const supabase = createClient();

    // 초기 세션 확인
    const initializeAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          handleAuthError(sessionError);
          return;
        }

        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Session initialization error:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Auth 상태 변경 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);

        switch (event) {
          case 'SIGNED_IN':
            setUser(session?.user ?? null);
            setError(null);
            break;

          case 'SIGNED_OUT':
            setUser(null);
            setError(null);
            break;

          case 'TOKEN_REFRESHED':
            setUser(session?.user ?? null);
            setError(null);
            break;

          case 'USER_UPDATED':
            setUser(session?.user ?? null);
            break;

          case 'INITIAL_SESSION':
            setUser(session?.user ?? null);
            setLoading(false);
            break;

          default:
            break;
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [handleAuthError]);

  // API 요청 에러 인터셉터 설정
  useEffect(() => {
    // 전역 fetch 래퍼로 auth 에러 감지
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);

        // 401 Unauthorized 응답 처리
        if (response.status === 401) {
          const clonedResponse = response.clone();
          try {
            const data = await clonedResponse.json();
            if (data.error?.includes('refresh') || data.error?.includes('token')) {
              handleAuthError({
                message: 'Session expired',
                status: 401,
                code: 'refresh_token_not_found',
              } as AuthError);
            }
          } catch {
            // JSON 파싱 실패 시 무시
          }
        }

        return response;
      } catch (err) {
        throw err;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [handleAuthError]);

  return (
    <AuthContext.Provider value={{ user, loading, error, signOut, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}
