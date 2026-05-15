# 🤖 Claude (Sonnet 4.6) 작업 지시서: Phase 5 학부모-교사 상호작용 및 알림 시스템 (CRM) 고도화

@Claude, 당신은 수학 학습 플랫폼의 리텐션을 높이기 위한 **Phase 5 (CRM 및 상호작용)** 과제를 수행해야 합니다.
사용자 경험(UX)과 심미성(Aesthetics)을 최우선으로 고려하며 아래의 작업 지시 사항을 순서대로 실행해 주세요. 각 단계마다 완료 여부를 확인하며 진행하십시오.

---

## 🎯 핵심 목표

단방향 리포트 발송을 넘어, **자동화된 알림(Notification)**과 **양방향 소통 채널(Micro Communication)**, 그리고 학부모의 행동을 유도하는 **가이드 체크리스트**를 구축하여 상용화 수준의 CRM 환경을 조성합니다.

---

## 🛠️ 작업 목록 (Implementation Plan)

### 1️⃣ Database 스키마 및 타입 확장 (Supabase)
* **목표:** 코멘트 및 알림, 체크리스트 관리를 위한 신규 테이블 추가
* **수행할 작업:**
  1. `supabase/migrations/` 경로에 새 SQL 마이그레이션 파일(`202605xxxx_phase5_crm_schema.sql`)을 생성하세요.
  2. 다음 3개의 테이블을 생성하고 RLS 정책을 설정하세요.
     - **`report_comments`**: 리포트 단위의 교사-학부모 간 피드백 스레드. (id, report_id, author_id, content, created_at)
     - **`parent_checklists`**: (id, parent_id, student_id, week_start_date, items: jsonb, completed: boolean)
     - **`notifications`**: **카카오 알림톡 확장을 고려하여 유연하게 설계해야 합니다.**
       - 필드: id, user_id, title, message, `channel` (enum: 'email', 'kakao', 'push', 'in_app'), `status` (enum: 'pending', 'sent', 'failed'), `template_id` (카카오 템플릿용), `provider_response` (jsonb), read: boolean, created_at
  3. `src/types/index.ts` 파일에 신규 테이블에 대한 TypeScript 인터페이스(타입)를 추가하세요.

### 2️⃣ 이메일 및 카카오 기반 알림 자동화 시스템 구축
* **목표:** 리포트 발행 시 학부모에게 자동 알림 전송 (이메일 우선, 카카오 확장 구조 마련)
* **수행할 작업:**
  1. `.env.local` 파일에 `RESEND_API_KEY` 환경변수가 등록되어 있는지 확인하도록 사용자에게 안내하거나, 코드 상에서 누락 시 예외처리를 확실히 하세요.
  2. `resend` 라이브러리를 설치하세요.
  3. `src/app/api/notifications/route.ts` (또는 유틸리티 파일)을 생성하여 알림 발송 파이프라인을 구축하세요.
     - DB의 `notifications` 테이블에 먼저 `status: 'pending'` 으로 레코드 생성
     - `channel` 값에 따라 분기 처리. (현재는 'email' 로직을 Resend로 발송, 성공 시 `status: 'sent'` 업데이트. 향후 'kakao' 등 대응)
  4. `src/app/teacher/reports/[id]/page.tsx` 내부의 리포트 발행(저장) 로직에 해당 알림 API 호출 코드를 연동하세요.

### 3️⃣ 양방향 마이크로 커뮤니케이션 (리포트 단위 코멘트 UI)
* **목표:** 특정 리포트의 AI 분석 결과에 교사만의 현장 의견을 덧붙이고, 학부모와 소통할 수 있는 채팅 형식의 UI 구현
* **수행할 작업:**
  1. `src/components/report/ReportComments.tsx` 컴포넌트를 신규 생성하세요.
  2. 기존의 단조로운 UI 대신, **Tailwind CSS (backdrop-blur, shadow-xl, gradient)** 및 **Framer Motion**을 적용하여 모던하고 프리미엄한 메신저 느낌을 구현하세요.
  3. 교사(파란색 계열)와 학부모(보라색 계열)의 말풍선 스타일을 시각적으로 명확히 구분하세요.
  4. 학부모용(`src/app/parent/reports/[id]/page.tsx`) 및 교사용(`src/app/teacher/reports/[id]/page.tsx`) 리포트 상세 페이지 최하단에 해당 컴포넌트를 부착하세요.

### 4️⃣ 학부모 대시보드 고도화 (`/parent`)
* **목표:** '학습 가이드 체크리스트' 관리 기능 추가 및 메인 페이지 개편
* **수행할 작업:**
  1. `src/app/parent/checklist/page.tsx` 페이지를 신설하세요. 이번 주 AI가 추천한 `Actionable Prescription` 항목들을 기반으로 체크리스트를 자동 렌더링해야 합니다.
  2. 체크 항목 토글 시 부드러운 전환 효과(Framer Motion)를 넣고, 세련된 컬러 팔레트를 적용하세요.
  3. `src/app/parent/page.tsx` 메인 대시보드 상단에 **안읽은 알림 뱃지**를 추가하고, "이번 주 가이드 체크리스트 요약 위젯"을 배치하여 미완료 항목을 강조하세요.

---

## 🎨 UI/UX 디자인 요구사항 (필수 준수 사항)

* **프리미엄 디자인 적용:** 단조로운 색상(단일 `blue-50` 등)을 피하고, 시맨틱하고 세련된 그라데이션, Glassmorphism(반투명 블러), 그림자 효과를 적극적으로 사용하세요.
* **마이크로 인터랙션:** 사용자가 버튼을 클릭하거나 코멘트를 입력/전송할 때 즉각적인 피드백(Framer Motion 애니메이션)이 있어야 합니다.
* 본인이 구현하면서 디자인적으로 밋밋하다고 판단되면, **가장 세련되고 프리미엄한 방향으로 자율적으로 고도화**하여 반영하십시오.

---

## ✅ 검증 및 마무리

작업을 완료한 후, `npm run build`를 실행하여 새로운 타입스크립트 에러가 발생하지 않는지 스스로 점검하십시오. (특히 `notifications` DB 스키마 구조가 제대로 반영되었는지 재확인하세요.) 오류가 없다면 수행한 작업의 결과를 요약하여 보고해 주시기 바랍니다.
