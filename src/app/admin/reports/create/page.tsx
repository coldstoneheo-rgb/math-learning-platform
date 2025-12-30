'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@/types';

// 리포트 타입 정의
const REPORT_TYPES = [
  {
    key: 'level_test',
    title: '레벨 테스트',
    description: '신규 학생 진단 테스트 - Baseline(기준점) 설정',
    icon: '🎯',
    href: '/admin/reports/level-test/new',
    color: 'red',
    badge: '신규 학생',
  },
  {
    key: 'test',
    title: '시험 분석',
    description: '시험지 이미지를 분석하여 상세한 학습 진단 리포트 생성',
    icon: '📝',
    href: '/admin/reports/new',
    color: 'blue',
  },
  {
    key: 'weekly',
    title: '주간 리포트',
    description: '한 주간의 학습 내용과 진도를 정리한 리포트 생성',
    icon: '📅',
    href: '/admin/reports/weekly/new',
    color: 'green',
    disabled: true, // Phase 3에서 구현 예정
  },
  {
    key: 'monthly',
    title: '월간 리포트',
    description: '한 달간의 학습 성과와 성장을 분석한 리포트 생성 (AI 분석 지원)',
    icon: '📆',
    href: '/admin/reports/monthly/new',
    color: 'purple',
  },
  {
    key: 'consolidated',
    title: '통합 분석',
    description: '여러 시험 결과를 종합하여 심층 분석 리포트 생성',
    icon: '📊',
    href: '/admin/reports/consolidated/new',
    color: 'orange',
  },
];

export default function ReportCreatePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      router.push('/login');
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (!userData || userData.role !== 'teacher') {
      router.push('/');
      return;
    }

    setUser(userData);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/admin" className="text-gray-500 hover:text-gray-700">← 대시보드</a>
            <h1 className="text-xl font-bold text-gray-900">리포트 생성</h1>
          </div>
          <span className="text-gray-600">{user?.name} 선생님</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">어떤 리포트를 생성하시겠습니까?</h2>
            <p className="text-gray-500">생성할 리포트 종류를 선택하세요</p>
          </div>

          <div className="grid gap-4">
            {REPORT_TYPES.map((type) => (
              <a
                key={type.key}
                href={type.disabled ? undefined : type.href}
                className={`block bg-white rounded-xl shadow-sm p-6 border-2 transition-all ${
                  type.disabled
                    ? 'border-gray-100 opacity-60 cursor-not-allowed'
                    : 'border-transparent hover:border-indigo-300 hover:shadow-md cursor-pointer'
                }`}
                onClick={(e) => type.disabled && e.preventDefault()}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                    type.color === 'red' ? 'bg-red-100' :
                    type.color === 'blue' ? 'bg-blue-100' :
                    type.color === 'green' ? 'bg-green-100' :
                    type.color === 'purple' ? 'bg-purple-100' :
                    'bg-orange-100'
                  }`}>
                    {type.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{type.title}</h3>
                      {'badge' in type && type.badge && (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded font-medium">
                          {type.badge}
                        </span>
                      )}
                      {type.disabled && (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                          준비 중
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-sm mt-1">{type.description}</p>
                  </div>
                  {!type.disabled && (
                    <div className="text-gray-400">
                      →
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>

          {/* 향후 추가 예정 안내 */}
          <div className="mt-8 bg-indigo-50 rounded-xl p-4 text-center">
            <p className="text-sm text-indigo-700">
              <span className="font-medium">향후 추가 예정:</span> 6개월 분석, 연간 분석, 기간 지정 분석
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
