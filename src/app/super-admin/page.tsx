'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();


  useEffect(() => {
    async function checkSuperAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
        
      if (profile?.role !== 'super_admin') {
        router.push('/');
        return;
      }
      
      setLoading(false);
    }
    
    checkSuperAdmin();
  }, [supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">슈퍼 관리자 대시보드</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">시스템 관리</h2>
          <p className="text-gray-500 mb-6">
            모든 테넌트(원장님) 계정, 학교/학원 데이터, 시스템 설정을 통합 관리할 수 있는 페이지입니다.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
              <h3 className="font-medium text-lg mb-2">테넌트(원장님) 관리</h3>
              <p className="text-sm text-gray-500 mb-4">신규 가입 승인 및 계정 상태 관리</p>
              <button className="text-indigo-600 font-medium text-sm">관리하기 &rarr;</button>
            </div>
            
            <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
              <h3 className="font-medium text-lg mb-2">시스템 로그</h3>
              <p className="text-sm text-gray-500 mb-4">오류 및 주요 활동 모니터링</p>
              <button className="text-indigo-600 font-medium text-sm">확인하기 &rarr;</button>
            </div>
            
            <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
              <h3 className="font-medium text-lg mb-2">데이터베이스 관리</h3>
              <p className="text-sm text-gray-500 mb-4">백업, 복원 및 마이그레이션 도구</p>
              <button className="text-indigo-600 font-medium text-sm">접근하기 &rarr;</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
