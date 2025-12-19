# Supabase CRUD Page Generator

Supabase 테이블에 대한 CRUD(생성, 조회, 수정, 삭제) 페이지를 생성합니다.

## 사용법
```
/supabase-crud [테이블명] [경로]
```

예시: `/supabase-crud students /admin/students`

## 인자
- $ARGUMENTS: 테이블명과 기본 경로 (예: "students /admin/students")

## 작업 지침

### 1. 인자 파싱
- 첫 번째 인자: Supabase 테이블명
- 두 번째 인자: 페이지 기본 경로

### 2. 생성할 파일들
```
[경로]/
├── page.tsx          # 목록 페이지
├── new/page.tsx      # 생성 페이지
└── [id]/page.tsx     # 상세/수정 페이지
```

### 3. 목록 페이지 템플릿 (page.tsx)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@/types';

interface [TableItem] {
  id: number;
  // 테이블 필드들
  created_at: string;
}

export default function [TableName]ListPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<[TableItem][]>([]);
  const [loading, setLoading] = useState(true);

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
    await loadItems();
    setLoading(false);
  };

  const loadItems = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('[table_name]')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('조회 오류:', error);
      return;
    }
    setItems(data || []);
  };

  const handleDelete = async (item: [TableItem]) => {
    if (!confirm('삭제하시겠습니까?')) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('[table_name]')
      .delete()
      .eq('id', item.id);

    if (error) {
      alert('삭제 중 오류가 발생했습니다.');
      return;
    }
    await loadItems();
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
            <a href="/admin" className="text-gray-500 hover:text-gray-700">← 대시보드</a>
            <h1 className="text-xl font-bold text-gray-900">[TableName] 관리</h1>
          </div>
          <span className="text-gray-600">{user?.name} 선생님</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <p className="text-gray-600">총 {items.length}개</p>
          <a
            href="[경로]/new"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            + 새로 추가
          </a>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500">데이터가 없습니다.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {/* 테이블 헤더 */}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    {/* 테이블 셀 */}
                    <td className="px-6 py-4 text-right">
                      <a href={`[경로]/${item.id}`} className="text-indigo-600 hover:text-indigo-800 text-sm mr-3">
                        수정
                      </a>
                      <button onClick={() => handleDelete(item)} className="text-red-600 hover:text-red-800 text-sm">
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
```

### 4. 생성 페이지 템플릿 (new/page.tsx)

인증 체크, 폼 상태 관리, Supabase insert 로직 포함

### 5. 상세/수정 페이지 템플릿 ([id]/page.tsx)

인증 체크, 데이터 로드, Supabase update 로직 포함

### 6. 참고 파일
- `src/app/admin/students/page.tsx` (학생 관리)
- `src/app/admin/reports/page.tsx` (리포트 관리)

### 7. 체크리스트
- [ ] 타입 정의 추가 (src/types/index.ts)
- [ ] 목록 페이지 생성
- [ ] 생성 페이지 생성
- [ ] 상세/수정 페이지 생성
- [ ] 빌드 테스트
