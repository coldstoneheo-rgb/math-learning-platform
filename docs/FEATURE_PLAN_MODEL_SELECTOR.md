# Feature Plan: Admin UI Model Selector

> **작성일**: 2026-04-29
> **참조**: `docs/AI_HYBRID_ROUTING_PLAN.md`, `src/lib/model-router.ts`

---

## 1. 개요

### 1.1 목적
교사(Admin)가 AI 분석 생성 시 사용되는 Gemini 모델을 확인하고, 필요시 수동으로 변경할 수 있는 UI 기능을 제공합니다.

### 1.2 현재 상태
- **모델 라우팅 로직**: `src/lib/model-router.ts` 구현 완료
- **자동 라우팅**: 리포트 타입/학년/시험명에 따라 Pro/Flash 자동 선택
- **UI 표시**: 미구현 (사용자가 어떤 모델이 사용되는지 알 수 없음)

---

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-01 | 분석 생성 화면에서 사용될 모델 표시 | P1 |
| FR-02 | 모델 선택 드롭다운 (Pro/Flash/Auto) | P2 |
| FR-03 | 모델 선택 이유 툴팁 표시 | P2 |
| FR-04 | 저장된 리포트에 사용된 모델 정보 표시 | P3 |
| FR-05 | 모델별 예상 비용/시간 정보 표시 | P3 |

### 2.2 비기능 요구사항

| ID | 요구사항 |
|----|---------|
| NFR-01 | 모델 변경이 분석 품질에 미치는 영향 경고 |
| NFR-02 | Feature Flag로 기능 ON/OFF 제어 |

---

## 3. UI 설계

### 3.1 분석 생성 페이지 (기본 모드)

```
┌─────────────────────────────────────────────────────────────┐
│  시험 분석 생성                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  학생: [김민수 ▼]    학년: 고2                               │
│                                                             │
│  시험명: [2학기 중간고사        ]                            │
│                                                             │
│  ┌─────────────────────────────────────────────┐            │
│  │ 🤖 AI 모델: gemini-pro-latest (자동 선택)       │            │
│  │    ├ 고등학생 (학년 ≥ 10)                    │            │
│  │    └ 중간고사 키워드 감지                     │            │
│  │                                              │            │
│  │  [모델 변경 ▾]                               │            │
│  └─────────────────────────────────────────────┘            │
│                                                             │
│  [AI 분석 시작]                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 모델 선택 드롭다운 (확장 모드)

```
┌─────────────────────────────────────────────────┐
│ 🤖 AI 모델 선택                                 │
├─────────────────────────────────────────────────┤
│ ○ 자동 (권장)                                   │
│   └ 시스템이 최적 모델 자동 선택               │
│                                                 │
│ ○ gemini-pro-latest                               │
│   └ 고품질 분석 | 예상 시간: ~60초             │
│   └ ⚠️ 비용이 약 10배 높음                     │
│                                                 │
│ ○ gemini-flash-latest                          │
│   └ 빠른 분석 | 예상 시간: ~15초               │
│   └ 💰 비용 효율적                             │
│                                                 │
│ [적용]  [취소]                                  │
└─────────────────────────────────────────────────┘
```

### 3.3 리포트 상세 페이지 (모델 정보)

```
┌─────────────────────────────────────────────────────────────┐
│  리포트 상세                                                │
├─────────────────────────────────────────────────────────────┤
│  김민수 | 2학기 중간고사 | 2026-04-20                       │
│                                                             │
│  ───────────────────────────────────────────────            │
│  📊 분석 정보                                               │
│  ───────────────────────────────────────────────            │
│  • 사용 모델: gemini-pro-latest                                │
│  • 생성 시간: 45초                                          │
│  • 토큰 사용: 입력 3,200 / 출력 2,100                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 기술 구현

### 4.1 데이터 스키마 변경

```sql
-- reports 테이블에 모델 정보 컬럼 추가
ALTER TABLE reports ADD COLUMN ai_model TEXT;
ALTER TABLE reports ADD COLUMN ai_model_tier TEXT;  -- 'pro' | 'flash'
ALTER TABLE reports ADD COLUMN ai_tokens_input INTEGER;
ALTER TABLE reports ADD COLUMN ai_tokens_output INTEGER;
ALTER TABLE reports ADD COLUMN ai_generation_time_ms INTEGER;
```

### 4.2 API 변경

```typescript
// POST /api/analyze
interface AnalyzeRequest {
  // 기존 필드...
  forceModel?: 'pro' | 'flash';  // 수동 모델 선택 시
}

interface AnalyzeResponse {
  // 기존 필드...
  modelUsed: string;          // 실제 사용된 모델
  modelTier: 'pro' | 'flash';
  tokensUsed: {
    input: number;
    output: number;
  };
  generationTimeMs: number;
}
```

### 4.3 컴포넌트 구조

```
src/components/admin/
├── ModelSelector/
│   ├── ModelSelector.tsx        # 메인 컴포넌트
│   ├── ModelOption.tsx          # 개별 옵션
│   ├── ModelBadge.tsx           # 현재 모델 배지
│   └── useModelRouting.ts       # 모델 라우팅 훅
```

### 4.4 Feature Flag

```typescript
// src/lib/feature-flags.ts
const FLAGS: Record<FeatureFlag, boolean> = {
  // ...기존 플래그
  admin_model_selector: false,  // 새 플래그
};
```

---

## 5. 구현 계획

### Phase 1: 모델 정보 표시 (P1)

| 태스크 | 예상 시간 | 설명 |
|--------|----------|------|
| DB 스키마 마이그레이션 | 1h | ai_model 등 컬럼 추가 |
| API 응답 확장 | 2h | 사용 모델/토큰 정보 반환 |
| ModelBadge 컴포넌트 | 2h | 현재 선택된 모델 표시 |
| 리포트 상세 페이지 업데이트 | 1h | 모델 정보 섹션 추가 |

### Phase 2: 모델 선택 기능 (P2)

| 태스크 | 예상 시간 | 설명 |
|--------|----------|------|
| ModelSelector 컴포넌트 | 3h | 드롭다운 UI |
| useModelRouting 훅 | 2h | 라우팅 미리보기 |
| API 요청 연동 | 1h | forceModel 파라미터 전달 |
| Feature Flag 연동 | 1h | 기능 토글 |

### Phase 3: 고급 기능 (P3)

| 태스크 | 예상 시간 | 설명 |
|--------|----------|------|
| 비용/시간 예측 표시 | 2h | 모델별 예상치 |
| 라우팅 이유 툴팁 | 1h | 왜 이 모델이 선택되었는지 |
| 사용 통계 대시보드 | 4h | 모델별 사용량/비용 시각화 |

---

## 6. 우선순위 결정 기준

| 기준 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| 교사 요청 빈도 | 높음 | 중간 | 낮음 |
| 구현 복잡도 | 낮음 | 중간 | 높음 |
| 비즈니스 가치 | 중간 | 높음 | 중간 |

---

## 7. 관련 파일

| 파일 | 역할 |
|------|------|
| `src/lib/model-router.ts` | 모델 라우팅 로직 (구현 완료) |
| `src/lib/feature-flags.ts` | Feature Flag 관리 |
| `src/app/admin/reports/new/page.tsx` | 시험 분석 생성 페이지 |
| `src/app/admin/reports/[id]/page.tsx` | 리포트 상세 페이지 |

---

**다음 단계**: Phase 1 구현 시작 (DB 스키마 마이그레이션)
