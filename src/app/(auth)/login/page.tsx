'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError(authError.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 올바르지 않습니다.' : authError.message);
        return;
      }

      if (data.user) {
        const { data: userData } = await supabase.from('users').select('role').eq('id', data.user.id).single();

        // 세션 쿠키가 설정되도록 잠시 대기 후 리다이렉트
        router.refresh();

        if (userData?.role === 'teacher') router.push('/admin');
        else if (userData?.role === 'parent') router.push('/parent');
        else router.push('/');
      }
    } catch (err) {
      setError('로그인 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-indigo-600">수학 학습 분석</Link>
          <p className="text-gray-600 mt-2">계정에 로그인하세요</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              placeholder="example@email.com" />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              placeholder="••••••••" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {loading ? '로그인 중...' : '로그인'}
          </button>

          <div className="text-center text-sm text-gray-600">
            계정이 없으신가요? <Link href="/signup" className="text-indigo-600 font-medium hover:text-indigo-700">회원가입</Link>
          </div>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">학부모 계정은 선생님의 초대를 통해 생성됩니다.</p>
      </div>
    </div>
  );
}
