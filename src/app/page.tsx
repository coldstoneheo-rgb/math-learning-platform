'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/common/ThemeToggle';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'teacher' | 'parent' | 'student'>('teacher');

  const tabContents = {
    teacher: {
      role: '선생님',
      icon: '👨‍🏫',
      description: '복잡하고 고된 학생 분석 업무를 AI 동반자에게 맡기고 수업에만 집중하세요.',
      steps: [
        { title: '1. 학생 등록 & 일정 관리', desc: '학생별 기본 학습 프로필과 수업 요일을 설정합니다.' },
        { title: '2. 학습 데이터/시험지 업로드', desc: '시험지 이미지나 PDF, 또는 수업 중 관찰한 정성적 관찰 내용을 간편하게 입력합니다.' },
        { title: '3. AI 리포트 자동 생성', desc: 'AI가 단 몇 초 만에 사고 패턴을 입체적으로 진단하고, 처방을 담은 보고서를 발행합니다.' },
      ],
      badge: '대시보드 관리 · 자동 리포트 · 분석 통계'
    },
    parent: {
      role: '학부모',
      icon: '👨‍👩‍👧',
      description: '우리 아이가 수학 문제를 "왜" 틀리는지, 어떻게 보완해가고 있는지 투명하게 공유받으세요.',
      steps: [
        { title: '1. 알림톡/링크 수신', desc: '선생님이 보낸 모바일 최적화 성장 보고서를 실시간으로 받아봅니다.' },
        { title: '2. 정밀 분석 & 극복 전략 열람', desc: '5가지 분석 관점과 구체적인 가정 내 지도 팁을 확인합니다.' },
        { title: '3. 성장 궤적 실시간 확인', desc: '3개월, 6개월 단위로 누적되는 성취도 변화와 향상 예측 궤적을 확인합니다.' },
      ],
      badge: '카카오톡 리포트 · 성장 궤적 · 맞춤 피드백'
    },
    student: {
      role: '학생',
      icon: '📚',
      description: '단순한 점수의 굴레에서 벗어나 나의 생각의 흐름을 보완하고 성장의 성취감을 느껴보세요.',
      steps: [
        { title: '1. 나의 처방전 확인', desc: '시험 후 나만 볼 수 있는 오답 진단서와 보완 포인트를 받습니다.' },
        { title: '2. 주의 포인트 훈련', desc: '나의 고질적인 계산 실수 패턴, 조건 누락 성향을 인식하고 교정합니다.' },
        { title: '3. 성장 비전 성취', desc: '개선 로드맵에 따른 훈련을 수행하며 획득한 성장 지표를 확인합니다.' },
      ],
      badge: '개인 처방전 · 약점 극복 · 성장 동기부여'
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 transition-colors duration-300">
      
      {/* 글로벌 상단 헤더 */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/75 dark:bg-slate-950/75 border-b border-indigo-50 dark:border-slate-800 transition-colors">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 text-xl font-black text-indigo-900 dark:text-indigo-400 tracking-tight">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md">
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="whitespace-nowrap">My Math Master</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors shadow-sm"
            >
              로그인
            </Link>
          </div>
        </div>
      </header>

      {/* 히어로 섹션 */}
      <main className="container mx-auto px-4 py-12 md:py-24">
        <div className="grid lg:grid-cols-12 gap-12 items-center max-w-6xl mx-auto">
          
          {/* 히어로 설명구 */}
          <div className="lg:col-span-7 text-left space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-100/80 dark:bg-indigo-950/50 border border-indigo-200/50 dark:border-indigo-900/50">
              <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300">💡 AI 기반 수학 성장 분석 솔루션</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 dark:text-white leading-tight tracking-tight">
              단 한 장의 시험지로 시작하는<br />
              놀라운 수학 성장의 로드맵,<br />
              <span className="bg-gradient-to-r from-indigo-600 to-purple-500 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400">My Math Master</span>
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              단순한 오답 체크를 넘어, 학생의 5대 사고 관점과 오답의 본질적 요인을 인공지능이 정밀 분석합니다. 선생님과 부모님, 학생이 실시간 성장 데이터를 공유하는 완전히 새로운 교육 협업을 시작해 보세요.
            </p>
            <div className="flex flex-row gap-3 pt-2">
              <Link href="/login" className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-xl font-bold text-base transition-all shadow-md active:scale-98">
                시작하기 →
              </Link>
              <a href="#features" className="px-6 py-3.5 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-base border border-indigo-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-800/80 transition-all">
                서비스 알아보기
              </a>
            </div>
          </div>

          {/* 히어로 시각화 (CSS 데모 카드) */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-sm bg-white/90 dark:bg-slate-900/90 border border-indigo-50 dark:border-slate-800/80 p-6 rounded-3xl shadow-xl backdrop-blur-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-xl"></div>
              
              {/* 상단 프로필 헤더 */}
              <div className="flex justify-between items-center mb-5 pb-4 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-sm">🎒</div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">최지수 학생</h4>
                    <p className="text-[10px] text-gray-400">중학교 2학년 1학기 과정</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 text-[10px] font-bold">
                  성장 가속 구간
                </span>
              </div>

              {/* 분석 결과 데모 */}
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-[10px] font-medium text-gray-400 block mb-1">🎯 5요소 역량 진단</span>
                  <div className="space-y-1.5">
                    <div>
                      <div className="flex justify-between text-[10px] font-semibold text-gray-600 dark:text-slate-300 mb-0.5">
                        <span>개념 응용력</span>
                        <span>85%</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: '85%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-semibold text-gray-600 dark:text-slate-300 mb-0.5">
                        <span>조건 분석력 (문제해독)</span>
                        <span className="text-amber-500 dark:text-amber-400">45% (보완 필요)</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: '45%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-gray-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block mb-1">🧠 AI 성장 처방 전략</span>
                  <p className="text-[11px] leading-relaxed text-gray-700 dark:text-slate-300 font-medium">
                    "연립방정식의 문장제 문제 해결 시, 문제를 끊어 읽으며 구하고자 하는 변수(x, y)를 명시적으로 식 위에 표시하는 식 수립 훈련 4주 진행 제안"
                  </p>
                </div>

                <div className="flex items-center justify-between text-[10px] pt-1">
                  <span className="text-gray-400">누적 성장 점수</span>
                  <span className="font-bold text-gray-900 dark:text-white">🚀 74점 → 88점 (예측)</span>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* 4대 강점 섹션 */}
        <section id="features" className="mt-32 max-w-6xl mx-auto">
          <div className="text-center space-y-3 mb-16">
            <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase">FEATURES</h3>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">AI가 설계하는 수학 마스터의 4가지 핵심 솔루션</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 max-w-xl mx-auto">기존의 성적 처리 방식을 혁신하여 성장에 필요한 모든 요소를 정밀 설계합니다.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon="🎯"
              title="5가지 입체적 분석"
              description="개념 연계성, 식 작성 완성도, 계산 오류 패턴, 문제 해독력, 전반적 풀이 태도까지 5대 역량을 인공지능이 해독해냅니다."
              tag="서술형 분석"
            />
            <FeatureCard
              icon="📊"
              title="5요소 초정밀 전략"
              description="'열심히 해라' 식의 조언을 넘어, 무엇을/어디서/얼마나/어떻게 보완해야 하며 이를 측정할 방법까지 5개 레이어로 행동 강령을 도출합니다."
              tag="행동 로드맵"
            />
            <FeatureCard
              icon="📈"
              title="성장 궤적 & 점수 예측"
              description="학생의 성적 이력과 취약 보완 추세를 바탕으로 3개월, 6개월 뒤의 실력 향상 예측 시뮬레이션을 그래프로 시각화합니다."
              tag="예측 모델"
            />
            <FeatureCard
              icon="🧠"
              title="AI 기억 서랍 (RAG)"
              description="학생별 피드백, 상담 기록, 과거 오답 트렌드를 벡터 인덱싱하여 다회차 리포트를 발행할 때 연속적인 성장 스토리를 추적합니다."
              tag="누적 연계 추적"
            />
          </div>
        </section>

        {/* 사용자 가이드 / 플랫폼 워크플로우 */}
        <section className="mt-32 max-w-4xl mx-auto bg-white dark:bg-slate-900/60 rounded-3xl border border-indigo-50/50 dark:border-slate-800/80 p-6 md:p-10 shadow-lg backdrop-blur-sm">
          <div className="text-center space-y-2 mb-10">
            <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase">HOW IT WORKS</h3>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white">성장을 위한 3중 피드백 루프</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">선생님, 학부모, 학생이 각자의 역할에서 최적의 인터페이스로 연동됩니다.</p>
          </div>

          {/* 역할 전환 탭 */}
          <div className="flex border-b border-gray-100 dark:border-slate-800 mb-8 justify-center gap-2">
            {(['teacher', 'parent', 'student'] as const).map((role) => (
              <button
                key={role}
                onClick={() => setActiveTab(role)}
                className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${
                  activeTab === role
                    ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-400 dark:text-slate-500 hover:text-gray-600'
                }`}
              >
                {tabContents[role].icon} {tabContents[role].role} 가이드
              </button>
            ))}
          </div>

          {/* 탭 내용 */}
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/50">
              <div>
                <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-100/50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">
                  {tabContents[activeTab].badge}
                </span>
                <p className="text-sm text-gray-700 dark:text-slate-300 font-semibold mt-2">
                  {tabContents[activeTab].description}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {tabContents[activeTab].steps.map((step, idx) => (
                <div key={idx} className="bg-slate-50 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800/80 p-4 rounded-xl">
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-1.5">{step.title}</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 하단 CTA */}
        <section className="mt-32 text-center max-w-3xl mx-auto space-y-6">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
            수학 성장은 단순한 점수 계산이 아닌,<br />
            올바른 피드백 고리의 완성에 있습니다.
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 max-w-xl mx-auto">
            My Math Master를 도입하여, 학생들에게 숫자의 평가를 넘어 성장에 대한 설레임과 비전을 선물해주세요.
          </p>
          <div>
            <Link
              href="/login"
              className="inline-block px-8 py-4 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-xl font-bold text-lg transition-all shadow-lg active:scale-98"
            >
              지금 시작하기
            </Link>
          </div>
        </section>

      </main>

      {/* 푸터 */}
      <footer className="border-t border-indigo-50 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 py-10 transition-colors mt-20">
        <div className="container mx-auto px-4 text-center space-y-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-slate-500">
            &copy; {new Date().getFullYear()} My Math Master. All rights reserved.
          </p>
          <div className="flex justify-center gap-4 text-xs text-gray-400 dark:text-slate-500">
            <a href="#features" className="hover:underline">기능 소개</a>
            <span>·</span>
            <Link href="/login" className="hover:underline">선생님 로그인</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, tag }: { icon: string; title: string; description: string; tag: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between">
      <div>
        <div className="text-3.5xl mb-4">{icon}</div>
        <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2">{title}</h4>
        <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed mb-4">{description}</p>
      </div>
      <div>
        <span className="inline-block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
          {tag}
        </span>
      </div>
    </div>
  );
}

