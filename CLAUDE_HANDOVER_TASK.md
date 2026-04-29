# 🤖 Claude Code 작업 지시서: 수학 학습 성장 시스템 UI/UX 고도화 및 버그 수정

@Claude, 당신은 현재 진단된 수학 학습 분석 플랫폼의 개선 과제를 수행해야 합니다. 
아래의 지시 사항을 순서대로 **모두** 실행해 주세요. 절대 임의로 생략하지 말고, 각 단계마다 완료 여부를 확인하며 진행하십시오.

---

## 단계 1: 프로젝트 현황 및 컴포넌트 파악
1. 현재 Git 브랜치 상태(`git status`)와 가장 최근 커밋 기록(`git log`)을 확인하여 작업 환경을 파악하세요.
2. 아래 3단계에 명시된 목표 컴포넌트(`GrowthLoopIndicator.tsx`, `StudyChecklist.tsx`, `globals.css`, `api/analyze/route.ts` 등)의 구조를 분석하세요.

---

## 단계 2: 필수 패키지 설치
UI/UX 고도화를 위해 다음 라이브러리가 필요합니다. 설치되어 있지 않다면 설치해 주세요.
*명령어 예시*: `npm install lucide-react framer-motion`

---

## 단계 3: 핵심 작업 목록 (Implementation Plan 기반)

이 작업의 목표는 MVP 수준의 단조로운 UI를 **'심미적이고 프리미엄스러운 (WOW 팩터)'** 디자인으로 전면 개편하고, 발생한 백엔드 결함을 수정하는 것입니다.

### 🎯 작업 1: [기능 보완] Anchor Loop 데이터 영속성 (Backend) 복구
* **파일:** `src/app/api/analyze/route.ts`
* **문제점:** AI 분석 결과로 `metaProfile`, `weaknesses`, `strengths` 데이터가 성공적으로 추출되지만 DB에 기록되지 않아 데이터 흐름이 단절된 생태입니다. (Anchor Loop 누락)
* **지시:** Gemini 인퍼런스 직후, `src/lib/context-builder.ts`의 `updateStudentMetaProfile` 함수(또는 해당 DB 업데이트 로직)를 반드시 호출하도록 로직을 수정하여 상태를 영구 저장하세요.

### 🎨 작업 2: [UI/UX 개선] 타이포그래피 및 아이콘 시스템 교체
* **파일:** `src/components/report/GrowthLoopIndicator.tsx` 등 UI 컴포넌트
* **지시:** 기존 코드에 하드코딩된 모든 운영체제 기본 이모지(예: 🎯, 📝, 🏆, 💡 등)를 찾아 전문적인 **`lucide-react` 아이콘**으로 전부 교체하세요. 앱 전체의 신뢰도를 높여야 합니다.

### 💎 작업 3: [UI/UX 개선] 프리미엄 디자인 패턴 (Design System) 적용
* **파일:** `src/app/globals.css`, `tailwind.config.ts`(또는 관련 CSS)
* **지시:** 
  1. Tailwind 변수를 활용하여 섬세한 시맨틱 컬러(예: 고급스러운 Slate, 깊이 있는 Indigo)를 설정하세요. 기존의 밋밋한 `bg-blue-50`과 같은 단색 지정을 걷어내야 합니다.
  2. 세련된 웹 폰트(예: Google Fonts의 `Inter` 또는 `Pretendard`)를 전역으로 적용하세요.

### 🎞️ 작업 4: [UI/UX 개선] 동적 인터랙션 및 애니메이션 추가
* **파일:** `src/components/report/GrowthLoopIndicator.tsx`, `src/components/study-plan/StudyChecklist.tsx`
* **지시:** 
  1. `framer-motion`을 사용하여 리포트 카드 진입 시 부드러운 스케일 업(Scale-up) 및 페이드 인(Fade-in) 애니메이션을 추가하세요.
  2. Baseline 대비 성장 성취도 등 주요 지표를 나타내는 박스에 **Glassmorphism(백드롭 블러/반투명 효과)** 및 은은한 그라데이션, 부드러운 박스 섀도우를 적용하세요.
  3. `StudyChecklist.tsx` 등 체크리스트가 있는 경우, 아이템 체크 시 부드러운 전환 효과를 구현하세요.

---

## 단계 4: 검증 및 마무리
수행한 코드가 오류 없이 빌드되는지 임시로 확인(`lint` 또는 타입 체크)한 후, 본인이 수정한 내용의 핵심 변경 사항을 간결하게 요약하여 보고해 주세요. 
작업 도중 애매한 부분(예: 특정 색상 코드나 애니메이션 속도)이 있다면, **가장 세련되고 프리미엄한 방향으로 자율적으로 결정**하여 반영하십시오.
