# 품질 점검 및 최적화 계획 (QA & Optimization Plan)

프로젝트가 고도화됨에 따라 **"개인별 수학 학습 현황 분석 및 성장"**이라는 핵심 목적을 효율적으로 달성하기 위한 기술적 점검 계획입니다.

---

## 1. 정기 점검 체크리스트 (Weekly/Monthly Review)

### A. 기능 및 목적 부합성 점검 (Alignment Check)
- [ ] **기능 과잉 방지:** 새로 추가된 기능이 학생의 '학습 분석'과 '성장'에 직접적으로 기여하는가? (화려함보다 실질적 데이터 가치 우선)
- [ ] **데이터 흐름 확인:** 입력된 데이터가 유실 없이 DB에 저장되고, 과거 데이터와 유기적으로 연결되는가? (통합 리포트 기능 정상 작동 여부)

### B. 코드 품질 점검 (Code Quality)
- [ ] **Type Safety:** `types.ts`의 인터페이스가 최신 스키마를 반영하고 있는가? 불필요한 Type Assertion(`as ...`)이나 `any`가 남용되지 않았는가?
- [ ] **Prop Drilling:** `App.tsx`에서 너무 깊은 계층으로 props를 전달하고 있지 않은가? (Context API 도입 검토 필요 시점 파악)
- [ ] **중복 로직:** 여러 컴포넌트(`ReportView`, `WeeklyReportView` 등)에서 반복되는 UI 로직이나 유틸리티 함수가 있다면 분리했는가?

---

## 2. 성능 최적화 계획 (Performance Optimization)

### A. 렌더링 최적화
*   **문제:** 리포트 데이터가 커질수록(이미지 포함) 렌더링 속도가 느려질 수 있음.
*   **해결:**
    *   `Recharts` 등 무거운 라이브러리는 필요한 시점에만 로드 (Code Splitting / Lazy Loading 고려).
    *   리스트 렌더링 시 `key` props의 고유성 보장.
    *   `React.memo`, `useMemo`, `useCallback`을 적절히 사용하여 불필요한 재렌더링 방지 (특히 그래프 컴포넌트).

### B. 메모리 관리
*   **문제:** 고화질 시험지 이미지 처리 및 PDF 생성(`html2canvas`) 시 브라우저 메모리 사용량 급증.
*   **해결:**
    *   업로드된 이미지는 분석 후 필요한 경우 리사이징하여 저장하거나, Base64 문자열 관리에 유의.
    *   `html2canvas` 실행 후 생성된 DOM 엘리먼트 및 캔버스 객체의 명시적 해제 확인.

### C. API 비용 및 속도 효율화
*   **문제:** 잦은 Gemini API 호출은 비용 증가 및 UX 저하(로딩 시간) 유발.
*   **해결:**
    *   **캐싱 전략:** 동일한 입력값(시험지+프롬프트)에 대한 결과는 `Dexie` DB에 저장된 값을 우선 사용.
    *   **토큰 최적화:** 프롬프트 내 불필요한 예시나 텍스트를 줄여 입력 토큰 절약.

---

## 3. 리팩토링 로드맵 (Refactoring Roadmap)

### 단기 (Immediate)
1.  `App.tsx`의 상태 관리 로직 분리: `useStudent`, `useReport` 등의 커스텀 훅으로 분리하여 메인 파일 크기 축소.
2.  `services/geminiService.ts`의 에러 핸들링 강화: API 실패 시 사용자에게 명확한 피드백(재시도 버튼 등) 제공 로직 보완.

### 중기 (Next Quarter)
1.  **Context API / Zustand 도입:** 전역 상태(현재 선택된 학생, 테마 설정 등) 관리를 위한 라이브러리 도입으로 Props Drilling 해결.
2.  **테스트 코드 도입:** 핵심 로직(`geminiService` 응답 파싱, `dbService` CRUD)에 대한 유닛 테스트 작성.

### 장기 (Future)
1.  **PWA (Progressive Web App) 전환:** 오프라인 지원 강화 및 앱 경험 제공.
2.  **백엔드 서버 구축:** Dexie(로컬)의 한계를 넘어, 다중 기기 동기화를 위한 전용 백엔드 및 DB 구축 고려.
