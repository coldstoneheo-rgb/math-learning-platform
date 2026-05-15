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
    href: '/teacher/reports/level-test/new',
    color: 'red',
    badge: '신규 학생',
  },
  {
    key: 'test',
    title: '시험 분석',
    description: '시험지 이미지를 분석하여 상세한 학습 진단 리포트 생성',
    icon: '📝',
    href: '/teacher/reports/new',
    color: 'blue',
  },
  {
    key: 'weekly',
    title: '주간 리포트',
    description: '한 주간의 학습 내용과 진도를 정리한 리포트 생성 (AI 분석 지원)',
    icon: '📅',
    href: '/teacher/reports/weekly/new',
    color: 'green',
  },
  {
    key: 'monthly',
    title: '월간 리포트',
    description: '한 달간의 학습 성과와 성장을 분석한 리포트 생성 (AI 분석 지원)',
    icon: '📆',
    href: '/teacher/reports/monthly/new',
    color: 'purple',
  },
  {
    key: 'consolidated',
    title: '통합 분석',
    description: '여러 시험 결과를 종합하여 심층 분석 리포트 생성',
    icon: '📊',
    href: '/teacher/reports/consolidated/new',
    color: 'orange',
  },
  {
    key: 'semi_annual',
    title: '반기 종합 리포트',
    description: '6개월간의 학습을 종합 분석 - Macro Loop 점검 (AI 분석 필수)',
    icon: '📈',
    href: '/teacher/reports/semi-annual/new',
    color: 'indigo',
    badge: 'Macro Loop',
  },
  {
    key: 'annual',
    title: '연간 종합 리포트',
    description: '1년간의 성장 스토리 - Baseline 대비 성장, 다음 학년 준비 (AI 분석 필수)',
    icon: '📚',
    href: '/teacher/reports/annual/new',
    color: 'amber',
    badge: 'Growth Story',
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
            <a href="/teacher" className="text-gray-500 hover:text-gray-700">← 대시보드</a>
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
            {REPORT_TYPES.map((type) => {
              const isDisabled = 'disabled' in type && (type as { disabled?: boolean }).disabled;
              return (
                <a
                  key={type.key}
                  href={isDisabled ? undefined : type.href}
                  className={`block bg-white rounded-xl shadow-sm p-6 border-2 transition-all ${
                    isDisabled
                      ? 'border-gray-100 opacity-60 cursor-not-allowed'
                      : 'border-transparent hover:border-indigo-300 hover:shadow-md cursor-pointer'
                  }`}
                  onClick={(e) => isDisabled && e.preventDefault()}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                      type.color === 'red' ? 'bg-red-100' :
                      type.color === 'blue' ? 'bg-blue-100' :
                      type.color === 'green' ? 'bg-green-100' :
                      type.color === 'purple' ? 'bg-purple-100' :
                      type.color === 'orange' ? 'bg-orange-100' :
                      type.color === 'indigo' ? 'bg-indigo-100' :
                      type.color === 'amber' ? 'bg-amber-100' :
                      'bg-gray-100'
                    }`}>
                      {type.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">{type.title}</h3>
                        {'badge' in type && type.badge && (
                          <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                            type.key === 'level_test' ? 'bg-red-100 text-red-600' :
                            type.key === 'semi_annual' ? 'bg-indigo-100 text-indigo-600' :
                            type.key === 'annual' ? 'bg-amber-100 text-amber-600' :
                            'bg-blue-100 text-blue-600'
                          }`}>
                            {type.badge}
                          </span>
                        )}
                        {isDisabled && (
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                            준비 중
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-sm mt-1">{type.description}</p>
                    </div>
                    {!isDisabled && (
                      <div className="text-gray-400">
                        →
                      </div>
                    )}
                  </div>
                </a>
              );
            })}
          </div>

          {/* Growth Loop 시스템 안내 */}
          <div className="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4">
            <p className="text-sm text-indigo-700 text-center">
              <span className="font-medium">Growth Loop 시스템:</span> 레벨 테스트 → 주간/월간(Micro Loop) → 반기/연간(Macro Loop)으로 학생의 성장을 연속 추적합니다.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
