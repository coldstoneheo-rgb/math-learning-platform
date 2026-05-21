'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    async function checkSuperAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserEmail(user.email || '');
      
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
        
      if (userData?.role !== 'super_admin') {
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-indigo-500/30">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/4 w-[1000px] h-[1000px] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute top-1/2 right-0 w-[800px] h-[800px] rounded-full bg-violet-600/10 blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="px-6 sm:px-10 py-6 flex justify-between items-center border-b border-white/10 bg-black/20 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Super Admin</h1>
              <p className="text-xs text-slate-400">{userEmail}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-all"
          >
            로그아웃
          </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 sm:px-10 py-12">
          
          {/* Quick Actions / Role Switch */}
          <section className="mb-12">
            <div className="p-8 rounded-3xl bg-gradient-to-br from-indigo-900/40 to-violet-900/40 border border-indigo-500/20 backdrop-blur-xl shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
                <svg className="w-32 h-32 text-indigo-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" /></svg>
              </div>
              
              <h2 className="text-2xl font-semibold mb-2">환영합니다, 관리자님</h2>
              <p className="text-slate-300 mb-8 max-w-2xl">
                선생님 대시보드로 이동하여 학급 및 학생 관리를 진행하거나, 시스템 전반의 상태를 모니터링하세요.
              </p>
              
              <Link href="/teacher" className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-medium shadow-lg shadow-indigo-500/30 transition-all gap-2 group">
                선생님 대시보드로 전환
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </section>

          {/* Metrics */}
          <section className="mb-12">
            <h3 className="text-lg font-medium text-slate-300 mb-6 px-2">시스템 현황</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: '총 학생 수', value: '0', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
                { label: '활성 테넌트', value: '1', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
                { label: '누적 리포트', value: '0', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                { label: '시스템 상태', value: '정상', highlight: true, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' }
              ].map((metric, i) => (
                <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${metric.highlight ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-slate-300'}`}>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={metric.icon} />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">{metric.label}</p>
                    <p className={`text-2xl font-semibold ${metric.highlight ? 'text-emerald-400' : 'text-white'}`}>{metric.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          
          {/* Admin Menus */}
          <section>
            <h3 className="text-lg font-medium text-slate-300 mb-6 px-2">관리 메뉴</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: '테넌트(원장님) 관리', desc: '신규 가입 승인 및 계정 상태, 권한 등 통합 관리', coming: true },
                { title: '시스템 로그 모니터링', desc: '플랫폼 주요 활동 내역 및 에러, 트래픽 현황 분석', coming: true },
                { title: '데이터베이스 제어', desc: '데이터 백업, 마이그레이션 스크립트 실행 및 복원', coming: true }
              ].map((menu, i) => (
                <div key={i} className="p-6 rounded-2xl bg-black/20 border border-white/5 hover:bg-white/5 hover:border-white/10 transition-all group cursor-not-allowed">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-medium text-lg text-slate-200">{menu.title}</h4>
                    {menu.coming && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white/10 text-slate-300 uppercase tracking-wider">
                        준비중
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed mb-6">
                    {menu.desc}
                  </p>
                  <div className="text-indigo-400/50 text-sm font-medium flex items-center gap-2">
                    접근하기 
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
