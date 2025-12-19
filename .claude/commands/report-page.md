# Report Page Generator

새로운 리포트 유형 페이지를 생성합니다.

## 사용법
```
/report-page [리포트유형] [경로]
```

예시: `/report-page weekly /admin/reports/weekly/new`

## 인자
- $ARGUMENTS: 리포트 유형과 경로 (예: "weekly /admin/reports/weekly/new")

## 작업 지침

### 1. 인자 파싱
- 첫 번째 인자: 리포트 유형 (weekly, monthly, quarterly 등)
- 두 번째 인자: 페이지 경로

### 2. 타입 정의 확인
`src/types/index.ts`에서 해당 리포트 타입의 데이터 구조를 확인하세요.

### 3. 페이지 생성
다음 패턴을 따라 페이지를 생성하세요:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Student, User } from '@/types';

export default function New[ReportType]ReportPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');

  // 폼 상태
  const [formData, setFormData] = useState({
    // 리포트 타입에 맞는 필드들
  });

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
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

    const { data: studentsData } = await supabase
      .from('students')
      .select('*')
      .order('name');

    setStudents(studentsData || []);
    setLoading(false);
  };

  const handleSave = async () => {
    setError('');
    if (!selectedStudentId) {
      setError('학생을 선택해주세요.');
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from('reports').insert({
        student_id: selectedStudentId,
        report_type: '[report_type]',
        test_name: '[리포트 제목]',
        test_date: new Date().toISOString().split('T')[0],
        analysis_data: formData,
      });

      if (insertError) throw insertError;
      alert('리포트가 저장되었습니다.');
      router.push('/admin/reports');
    } catch (err: any) {
      setError(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const getGradeLabel = (grade: number): string => {
    if (grade <= 6) return `초${grade}`;
    if (grade <= 9) return `중${grade - 6}`;
    return `고${grade - 9}`;
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
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/admin/reports" className="text-gray-500 hover:text-gray-700">
              ← 리포트 목록
            </a>
            <h1 className="text-xl font-bold text-gray-900">[리포트명] 작성</h1>
          </div>
          <span className="text-gray-600">{user?.name} 선생님</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* 학생 선택 섹션 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">1. 학생 선택</h2>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(Number(e.target.value) || '')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">학생을 선택하세요</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} ({getGradeLabel(student.grade)}) - {student.student_id}
                </option>
              ))}
            </select>
          </div>

          {/* 추가 폼 섹션들 - 리포트 타입에 맞게 구현 */}

          {/* 저장 버튼 */}
          <button
            onClick={handleSave}
            disabled={saving || !selectedStudentId}
            className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '저장 중...' : '리포트 저장'}
          </button>
        </div>
      </main>
    </div>
  );
}
```

### 4. 참고 파일
기존 리포트 페이지들을 참고하세요:
- `src/app/admin/reports/new/page.tsx` (시험 분석)
- `src/app/admin/reports/monthly/new/page.tsx` (월간 리포트)
- `src/app/admin/reports/consolidated/new/page.tsx` (통합 리포트)

### 5. 체크리스트
- [ ] 디렉토리 생성
- [ ] page.tsx 파일 생성
- [ ] 타입 정의 확인/추가
- [ ] 빌드 테스트
