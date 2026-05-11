'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User, Student, Report, ActionablePrescriptionItem, ParentChecklist, ParentChecklistItem } from '@/types';
import Link from 'next/link';

interface StudentWithReports extends Student {
  reports: Report[];
}

/**
 * /parent/checklist
 * 학부모 주간 가이드 체크리스트 페이지
 *
 * - AI 리포트의 Actionable Prescription 기반으로 이번 주 체크리스트 자동 생성
 * - 프리미엄 UI: 그라데이션 카드, 완료 애니메이션, 진행률 링 표시
 */
export default function ParentChecklistPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [children, setChildren] = useState<StudentWithReports[]>([]);
  const [selectedChild, setSelectedChild] = useState<StudentWithReports | null>(null);
  const [checklist, setChecklist] = useState<ParentChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 이번 주 월요일 날짜 계산
  const getWeekStart = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 월요일 기준
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    return monday.toISOString().split('T')[0];
  };

  const weekStart = getWeekStart();

  const loadOrCreateChecklist = useCallback(async (child: StudentWithReports, userId: string) => {
    const supabase = createClient();

    // 기존 체크리스트 조회
    const { data: existing } = await supabase
      .from('parent_checklists')
      .select('*')
      .eq('parent_id', userId)
      .eq('student_id', child.id)
      .eq('week_start_date', weekStart)
      .single();

    if (existing) {
      setChecklist(existing as ParentChecklist);
      return;
    }

    // 최근 리포트에서 Actionable Prescription 추출하여 체크리스트 생성
    const recentReports = child.reports
      .filter(r => ['test', 'weekly', 'monthly'].includes(r.report_type))
      .slice(0, 3);

    const items: ParentChecklistItem[] = [];
    let order = 1;

    for (const report of recentReports) {
      const data = report.analysis_data as unknown as Record<string, unknown>;
      const prescriptions = (data?.actionablePrescription ?? (data?.aiAnalysis as Record<string, unknown>)?.actionablePrescription) as ActionablePrescriptionItem[] | undefined;

      if (Array.isArray(prescriptions)) {
        for (const p of prescriptions.slice(0, 3)) {
          items.push({
            id: `${report.id}-${order}`,
            title: p.title,
            description: `${p.whatToDo} ${p.howMuch ? `(${p.howMuch})` : ''}`.trim(),
            priority: p.priority as 1 | 2 | 3,
            completed: false,
            source_report_id: report.id,
          });
          order++;
          if (items.length >= 7) break;
        }
      }
      if (items.length >= 7) break;
    }

    // 기본 가이드 항목 (리포트 데이터가 없을 때)
    if (items.length === 0) {
      items.push(
        {
          id: 'default-1',
          title: '오늘 수학 공부 격려하기',
          description: '아이가 공부를 마치면 구체적으로 칭찬해 주세요',
          priority: 1,
          completed: false,
        },
        {
          id: 'default-2',
          title: '리포트 함께 읽어보기',
          description: '이번 주 리포트를 아이와 함께 살펴보세요',
          priority: 2,
          completed: false,
        },
        {
          id: 'default-3',
          title: '틀린 문제 확인하기',
          description: '오답 노트를 함께 확인해 주세요',
          priority: 2,
          completed: false,
        }
      );
    }

    // DB에 저장
    const { data: created } = await supabase
      .from('parent_checklists')
      .insert({
        parent_id: userId,
        student_id: child.id,
        week_start_date: weekStart,
        items,
        completed: false,
      })
      .select('*')
      .single();

    if (created) {
      setChecklist(created as ParentChecklist);
    }
  }, [weekStart]);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) { router.push('/login'); return; }

      const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single();
      if (!userData || userData.role !== 'parent') { router.push('/'); return; }

      setUser(userData);

      const { data: students } = await supabase
        .from('students')
        .select('*')
        .eq('parent_id', authUser.id);

      const reportPromises = (students || []).map(s =>
        supabase.from('reports').select('*').eq('student_id', s.id).order('created_at', { ascending: false }).limit(10)
      );
      const reportResults = await Promise.all(reportPromises);

      const childrenWithReports: StudentWithReports[] = (students || []).map((s, i) => ({
        ...s,
        reports: reportResults[i]?.data || [],
      }));

      setChildren(childrenWithReports);

      if (childrenWithReports.length > 0) {
        setSelectedChild(childrenWithReports[0]);
        await loadOrCreateChecklist(childrenWithReports[0], authUser.id);
      }

      setLoading(false);
    };

    init();
  }, [router, loadOrCreateChecklist]);

  const handleChildChange = async (child: StudentWithReports) => {
    if (!user) return;
    setSelectedChild(child);
    setChecklist(null);
    await loadOrCreateChecklist(child, user.id);
  };

  const toggleItem = async (itemId: string) => {
    if (!checklist || saving) return;

    const updatedItems = checklist.items.map(item =>
      item.id === itemId
        ? { ...item, completed: !item.completed, completed_at: !item.completed ? new Date().toISOString() : undefined }
        : item
    );
    const allDone = updatedItems.every(i => i.completed);

    const updatedChecklist: ParentChecklist = { ...checklist, items: updatedItems, completed: allDone };
    setChecklist(updatedChecklist); // 낙관적 업데이트

    setSaving(true);
    const supabase = createClient();
    await supabase
      .from('parent_checklists')
      .update({ items: updatedItems, completed: allDone })
      .eq('id', checklist.id);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const completedCount = checklist?.items.filter(i => i.completed).length ?? 0;
  const totalCount = checklist?.items.length ?? 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // 우선순위별 라벨
  const priorityLabel = (p: 1 | 2 | 3) =>
    p === 1 ? { text: '지금 바로', bg: 'bg-rose-50', badge: 'bg-rose-100 text-rose-600', dot: 'bg-rose-500' }
    : p === 2 ? { text: '이번 주', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500' }
    : { text: '꾸준히', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-600', dot: 'bg-blue-400' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      {/* 헤더 */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10 border-b border-gray-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/parent" className="text-gray-400 hover:text-gray-600 transition-colors text-sm">
              ← 대시보드
            </Link>
            <span className="text-gray-200">|</span>
            <h1 className="text-lg font-bold text-gray-800">이번 주 가이드 체크리스트</h1>
          </div>
          {saving && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
              저장 중...
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* 자녀 선택 */}
        {children.length > 1 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => handleChildChange(child)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                  selectedChild?.id === child.id
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {child.name}
              </button>
            ))}
          </div>
        )}

        {/* 진행률 카드 */}
        {selectedChild && (
          <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-6 mb-6 text-white shadow-lg shadow-indigo-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-sm mb-1">
                  {selectedChild.name} 학생 · {new Date(weekStart).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}주
                </p>
                <h2 className="text-2xl font-bold mb-1">
                  {progressPercent === 100 ? '🎉 모두 완료했어요!' : `${completedCount} / ${totalCount} 완료`}
                </h2>
                <p className="text-indigo-100 text-sm">
                  {progressPercent < 30 ? '시작해 볼까요?' : progressPercent < 70 ? '잘 하고 있어요!' : progressPercent < 100 ? '거의 다 왔어요!' : '이번 주 완벽합니다!'}
                </p>
              </div>
              {/* 원형 진행률 */}
              <div className="relative w-20 h-20 flex-shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9"
                    fill="none"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${progressPercent} ${100 - progressPercent}`}
                    style={{ transition: 'stroke-dasharray 0.5s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold">{progressPercent}%</span>
                </div>
              </div>
            </div>

            {/* 프로그레스 바 */}
            <div className="mt-4">
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 체크리스트 항목 */}
        {checklist && checklist.items.length > 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map(priority => {
              const priorityItems = checklist.items.filter(i => i.priority === priority);
              if (priorityItems.length === 0) return null;
              const pl = priorityLabel(priority as 1 | 2 | 3);

              return (
                <div key={priority}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <div className={`w-2 h-2 rounded-full ${pl.dot}`} />
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{pl.text}</span>
                  </div>

                  <div className="space-y-2">
                    {priorityItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                          item.completed
                            ? 'bg-green-50 border-green-200 opacity-70'
                            : `${pl.bg} border-gray-100 hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0`
                        }`}
                        style={{ transform: item.completed ? 'none' : undefined }}
                      >
                        <div className="flex items-start gap-3">
                          {/* 체크박스 */}
                          <div className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 mt-0.5 flex items-center justify-center transition-all duration-200 ${
                            item.completed
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-300 bg-white'
                          }`}>
                            {item.completed && (
                              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${pl.badge}`}>
                                {pl.text}
                              </span>
                            </div>
                            <p className={`font-semibold text-sm ${item.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                              {item.title}
                            </p>
                            {item.description && (
                              <p className={`text-xs mt-1 ${item.completed ? 'text-gray-300' : 'text-gray-500'}`}>
                                {item.description}
                              </p>
                            )}
                          </div>

                          {item.completed && (
                            <span className="text-green-500 text-lg flex-shrink-0">✓</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <div className="text-4xl mb-3">📝</div>
            <h3 className="font-semibold text-gray-700 mb-1">체크리스트 준비 중</h3>
            <p className="text-sm text-gray-400">리포트가 생성되면 가이드 체크리스트가 자동으로 만들어집니다.</p>
            <Link href="/parent" className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
              대시보드로 이동
            </Link>
          </div>
        )}

        {/* 완료 시 격려 메시지 */}
        {progressPercent === 100 && (
          <div className="mt-6 p-5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl text-white text-center shadow-lg">
            <div className="text-3xl mb-2">🎉</div>
            <h3 className="font-bold text-lg mb-1">이번 주 체크리스트 완료!</h3>
            <p className="text-green-100 text-sm">아이의 성장을 위한 모든 가이드를 실천했어요. 훌륭한 부모님입니다!</p>
          </div>
        )}
      </main>
    </div>
  );
}
