'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '', name: '', role: 'teacher' as 'teacher' | 'parent' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validateForm = (): string | null => {
    if (!formData.email || !formData.password || !formData.name) return '모든 필수 항목을 입력해주세요.';
    if (formData.password.length < 6) return '비밀번호는 최소 6자 이상이어야 합니다.';
    if (formData.password !== formData.confirmPassword) return '비밀번호가 일치하지 않습니다.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return '유효한 이메일 주소를 입력해주세요.';
    return null;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { data: { name: formData.name, role: formData.role } },
      });

      if (authError) {
        setError(authError.message.includes('already registered') ? '이미 등록된 이메일 주소입니다.' : authError.message);
        return;
      }

      if (data.user) {
        await supabase.from('users').update({ name: formData.name, role: formData.role }).eq('id', data.user.id);
        setSuccess(true);
        if (!data.session) setTimeout(() => router.push('/login'), 3000);
        else router.push(formData.role === 'teacher' ? '/admin' : '/parent');
      }
    } catch (err) {
      setError('회원가입 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">회원가입 완료!</h2>
          <p className="text-gray-600 mb-4">이메일 확인 후 로그인해주세요.</p>
          <p className="text-sm text-gray-500">잠시 후 로그인 페이지로 이동합니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-indigo-600">수학 학습 분석</Link>
          <p className="text-gray-600 mt-2">새 계정 만들기</p>
        </div>

        <form onSubmit={handleSignup} className="bg-white rounded-2xl shadow-xl p-8 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">이름 <span className="text-red-500">*</span></label>
            <input name="name" type="text" value={formData.name} onChange={handleChange} required placeholder="홍길동"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">이메일 <span className="text-red-500">*</span></label>
            <input name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="example@email.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">사용자 유형 <span className="text-red-500">*</span></label>
            <select name="role" value={formData.role} onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white">
              <option value="teacher">선생님</option>
              <option value="parent">학부모</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">학부모 계정은 선생님의 초대를 통해 학생과 연결됩니다.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호 <span className="text-red-500">*</span></label>
            <input name="password" type="password" value={formData.password} onChange={handleChange} required minLength={6} placeholder="최소 6자 이상"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호 확인 <span className="text-red-500">*</span></label>
            <input name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} required placeholder="비밀번호 재입력"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {loading ? '처리 중...' : '회원가입'}
          </button>

          <div className="text-center text-sm text-gray-600">
            이미 계정이 있으신가요? <Link href="/login" className="text-indigo-600 font-medium hover:text-indigo-700">로그인</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
