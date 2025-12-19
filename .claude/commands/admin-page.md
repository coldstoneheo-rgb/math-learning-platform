# Admin Page Generator

인증이 적용된 Admin 페이지를 생성합니다.

## 사용법
```
/admin-page [페이지명] [경로]
```

예시: `/admin-page 설정 /admin/settings`

## 인자
- $ARGUMENTS: 페이지명과 경로 (예: "설정 /admin/settings")

## 작업 지침

### 1. 인자 파싱
- 첫 번째 인자: 페이지 제목 (한글 가능)
- 두 번째 인자: 페이지 경로

### 2. Admin 페이지 템플릿

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@/types';

export default function [PageName]Page() {
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
            <a href="/admin" className="text-gray-500 hover:text-gray-700">
              ← 대시보드
            </a>
            <h1 className="text-xl font-bold text-gray-900">[페이지명]</h1>
          </div>
          <span className="text-gray-600">{user?.name} 선생님</span>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          {/* 페이지 컨텐츠 */}
          <p className="text-gray-600">페이지 컨텐츠를 여기에 추가하세요.</p>
        </div>
      </main>
    </div>
  );
}
```

### 3. 스타일 가이드

#### 헤더
- 흰색 배경 (`bg-white shadow-sm`)
- 뒤로가기 링크 + 페이지 제목 + 사용자 정보

#### 카드
- 흰색 배경, 둥근 모서리, 그림자
- `bg-white rounded-xl shadow-sm p-6`

#### 버튼
- Primary: `bg-indigo-600 text-white hover:bg-indigo-700`
- Secondary: `border border-gray-300 text-gray-700 hover:bg-gray-50`
- Danger: `text-red-600 hover:text-red-800`

#### 폼 요소
- Input: `px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500`
- Select: 동일 + `bg-white`
- Textarea: 동일

#### 테이블
- 컨테이너: `bg-white rounded-xl shadow-sm overflow-hidden`
- 헤더: `bg-gray-50 border-b`
- 행 hover: `hover:bg-gray-50`

### 4. 참고 파일
- `src/app/admin/page.tsx` (대시보드)
- `src/app/admin/students/page.tsx` (학생 관리)
- `src/app/admin/reports/page.tsx` (리포트 관리)

### 5. 체크리스트
- [ ] 디렉토리 생성
- [ ] page.tsx 파일 생성
- [ ] 인증 로직 확인
- [ ] 스타일 일관성 확인
- [ ] 빌드 테스트
