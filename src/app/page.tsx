import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-indigo-600">수학 학습 분석 플랫폼</h1>
        <Link href="/login" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
          로그인
        </Link>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
            AI 기반 개인 맞춤형<br />
            <span className="text-indigo-600">수학 학습 컨설팅</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            단순 점수 분석을 넘어, 학생의 사고 패턴과 학습 습관을 깊이 있게 파악하여
            개인화된 학습 개선 방안과 미래 성장 비전을 제시합니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login" className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors shadow-lg">
              시작하기
            </Link>
            <a href="#features" className="px-8 py-4 bg-white text-indigo-600 rounded-xl font-bold text-lg border-2 border-indigo-200 hover:border-indigo-300 transition-colors">
              자세히 보기
            </a>
          </div>
        </div>

        <section id="features" className="mt-24 grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <FeatureCard icon="🎯" title="5가지 관점 심층 분석" description="사고의 출발점, 풀이 과정, 계산 패턴, 문제 해석, 풀이 습관을 다각도로 분석합니다." />
          <FeatureCard icon="📊" title="구체적 개선 전략" description="무엇을, 어디서, 얼마나, 어떻게, 측정 방법까지 5요소로 구성된 실행 가능한 전략을 제시합니다." />
          <FeatureCard icon="🚀" title="성장 예측 및 비전" description="3개월, 6개월 후 예상 점수와 장기적 성장 경로를 제시하여 학습 동기를 부여합니다." />
        </section>

        <section className="mt-24 max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-center text-gray-900 mb-8">누구를 위한 서비스인가요?</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <UserTypeCard icon="👨‍🏫" title="선생님" features={['학생 관리', '시험지 분석', '리포트 생성', '학부모 계정 관리']} />
            <UserTypeCard icon="👨‍👩‍👧" title="학부모" features={['자녀 리포트 열람', '성장 그래프 확인', 'PDF 다운로드', '학습 계획 확인']} />
            <UserTypeCard icon="📚" title="학생" features={['본인 리포트 열람', '약점 파악', '개선 전략 확인', '성장 추적']} />
          </div>
        </section>
      </main>

      <footer className="container mx-auto px-4 py-8 text-center text-gray-500 text-sm">
        <p>&copy; {new Date().getFullYear()} 수학 학습 분석 플랫폼. All rights reserved.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
      <div className="text-4xl mb-4">{icon}</div>
      <h4 className="text-xl font-bold text-gray-900 mb-2">{title}</h4>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function UserTypeCard({ icon, title, features }: { icon: string; title: string; features: string[] }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
      <div className="text-3xl mb-3">{icon}</div>
      <h4 className="text-lg font-bold text-gray-900 mb-3">{title}</h4>
      <ul className="space-y-2">
        {features.map((feature, i) => (
          <li key={i} className="text-gray-600 text-sm flex items-center">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}
