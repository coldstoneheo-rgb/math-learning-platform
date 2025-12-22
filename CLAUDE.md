# CLAUDE.md - AI Assistant Guide

This document provides comprehensive guidance for AI assistants working with the Math Test Analysis Report Generator codebase.

## Table of Contents
1. [Project Overview](#project-overview)
2. [Core Purpose and Philosophy](#core-purpose-and-philosophy)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [Directory Structure](#directory-structure)
6. [Data Models](#data-models)
7. [Key Services](#key-services)
8. [Development Workflow](#development-workflow)
9. [Code Conventions](#code-conventions)
10. [Common Tasks](#common-tasks)
11. [AI Integration](#ai-integration)
12. [Testing and Build](#testing-and-build)
13. [Optimization Considerations](#optimization-considerations)

---

## Project Overview

**AI Math Learning Report Generator** is a React-based application that analyzes student math test performance and generates comprehensive learning reports. It uses AI (Google Gemini) for deep analysis, local database storage (Dexie.js) for data persistence, and integrates with Google Sheets for backup and synchronization.

**AI Studio App URL:** https://ai.studio/apps/drive/1Pzqkv8G6KhBGYn2cmeuHMpuNjVUoAkoD

### Key Features
- Student management with unique ID generation
- Four report types: Weekly, Monthly, Test Analysis, and Consolidated
- OCR and AI-powered test paper analysis
- Data visualization with charts
- PDF export functionality
- Local-first architecture with cloud sync
- CSV bulk import for historical data

---

## Core Purpose and Philosophy

**"개인별 수학 학습 현황을 분석하고 학습 능력을 성장시키기 위함"**
**"Analyze individual math learning status and foster learning growth"**

### Design Principles
1. **Data Continuity Over One-Time Assessment:** Every feature should support long-term tracking and growth analysis
2. **Actionable Insights:** Reports must provide specific, executable recommendations, not generic advice
3. **Offline-First:** Local database ensures data availability without internet dependency
4. **Type Safety:** Strict TypeScript usage to prevent runtime errors
5. **Avoid Over-Engineering:** Keep solutions simple and focused on the core purpose

### Target Users
- **Teachers/Instructors:** Manage student data systematically and provide professional feedback
- **Students/Parents:** Receive detailed weakness analysis and actionable improvement plans

---

## Tech Stack

### Core Framework
- **React 19.2.0** - UI framework
- **TypeScript 5.2.2** - Type-safe development (Strict mode)
- **Vite 5.2.0** - Build tool and dev server

### UI & Styling
- **Tailwind CSS 3.4.1** - Utility-first CSS framework
- **Recharts 2.12.0** - Data visualization library

### AI & Data Processing
- **Google Gemini API** (`@google/genai 1.20.0`) - AI analysis engine
  - Model: `gemini-2.5-flash` for speed and analysis
- **Dexie.js 4.2.0** - IndexedDB wrapper for local storage
- **PapaParse 5.5.3** - CSV parsing for bulk imports

### Export & Integration
- **html2canvas 1.4.1** - Screenshot generation for PDF
- **jspdf 2.5.1** - PDF document generation
- **Google Apps Script** - Google Sheets synchronization

### Environment Variables
- `VITE_GEMINI_API_KEY` - Set in `.env.local` (accessed via `import.meta.env.VITE_GEMINI_API_KEY` in browser)

---

## Architecture

### Data Flow
```
1. INPUT → User selects student → Chooses report type → Inputs data/uploads files
2. PROCESSING → geminiService sends data to Gemini → Receives structured JSON analysis
3. STORAGE → dbService saves to IndexedDB via Dexie → Data persists locally
4. SYNC → Background sync to Google Sheets (optional, for backup)
5. OUTPUT → Data visualized with Recharts → Exported as PDF via html2canvas + jspdf
```

### Component Architecture
```
AppContext (Global state management) - NEW in Phase 0
├── Provides: students, reports, weeklyReports, monthlyReports
├── CRUD operations: add, update, delete for all entities
└── Eliminates prop drilling across components

App.tsx (Main router & state management)
├── StudentSelector → Select/manage students
├── ReportTypeSelector → Choose report type
├── DataManager → Manage existing reports
├── Report Generators (based on type)
│   ├── WeeklyReportView → Weekly learning reports
│   ├── MonthlyReportView → Monthly progress reports
│   ├── ReportView → Test analysis reports
│   ├── ConsolidatedReportView → Comparative analysis
│   └── MobileReportView → Mobile-optimized report view (NEW in Phase 0)
│       ├── 4-section layout: Header, Deep Cause, My Position, Potential
│       ├── Advanced charts: Pie, Radar (5-axis capability), Line, Bar
│       └── Optimized for A4 PDF export
└── Components (shared)
    ├── ReportHeader, Card, icons
    ├── TestInfoSection, TestResultSection
    ├── DetailedAnalysisSection, ResultAnalysisSection
    ├── StrengthsWeaknessesSection, SwotSection
    ├── StrategySection, ConclusionSection (enhanced 5-element display)
    └── EditModal, SettingsModal
```

---

## Directory Structure

```
/
├── src/
│   ├── components/           # UI Components (30+ files)
│   │   ├── icons.tsx         # Icon library
│   │   ├── Card.tsx          # Reusable card component
│   │   ├── Report*.tsx       # Report view/generation components
│   │   ├── MobileReportView.tsx  # Mobile-optimized view (NEW)
│   │   ├── Student*.tsx      # Student management components
│   │   ├── *Section.tsx      # Report section components
│   │   └── *Modal.tsx        # Modal dialogs
│   │
│   ├── context/              # Global state management (NEW)
│   │   └── AppContext.tsx    # React Context for app-wide state
│   │
│   ├── services/             # Business logic & external APIs
│   │   ├── dbService.ts      # Dexie database schema & CRUD
│   │   ├── geminiService.ts  # AI prompt engineering & API calls
│   │   ├── googleSheetsService.ts  # Google Sheets sync logic
│   │   └── settingsService.ts      # App settings management
│   │
│   ├── types.ts              # Global TypeScript type definitions
│   ├── mockData.ts           # Sample data for development/testing
│   ├── App.tsx               # Main application component
│   └── index.tsx             # Application entry point
│
├── index.html                # HTML template
├── vite.config.ts            # Vite configuration
├── tailwind.config.js        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript configuration
├── package.json              # Dependencies and scripts
│
├── .env.local                # Environment variables (gitignored)
├── .gitignore                # Git ignore rules
│
├── MathLearning_PRD_v2.0_Improved.md  # Phase 0 comprehensive PRD (NEW)
├── IMPROVEMENT_ROADMAP.md    # Phase-by-phase roadmap
│
└── Documentation/
    ├── README.md             # Quick start guide
    ├── PRD.md                # Product requirements (Korean)
    ├── PROJECT_GUIDE.md      # Technical structure (Korean)
    └── QA_AND_OPTIMIZATION.md # Quality assurance plan (Korean)
```

**Important Notes:**
- All source code is in `/src/`
- Types are centralized in `src/types.ts` (Single Source of Truth)
- Components follow a flat structure in `src/components/`
- Services handle all external interactions (DB, API, Sheets)

---

## Data Models

All type definitions are in `src/types.ts`. Key interfaces:

### Student Management
```typescript
interface Student {
  id?: number;              // Auto-generated by Dexie
  studentId: string;        // Format: {Level}{Year}{Grade}{Sequence}
  name: string;
  level: string;            // P, M, H, A
  grade: string;
  school?: string;
  startDate?: string;
  // Phase 0: Added for personalized analysis
  learningStyle?: 'visual' | 'verbal' | 'logical';
  personalityTraits?: string[];
}
```

### Report Types
```typescript
type ReportType = 'weekly' | 'monthly' | 'test' | 'consolidated';
```

### Test Analysis Report
```typescript
interface AnalysisReport {
  id?: number;
  testInfo: TestInfo;                    // Test metadata
  testResults: TestResults;              // Scores and rankings
  resultAnalysis: ResultAnalysis;        // Trends and comparisons
  detailedAnalysis?: DetailedProblemAnalysis[];  // Problem-by-problem (5-perspective analysis)
  macroAnalysis: MacroAnalysis;          // Macro-level analysis with futureVision
  strengthsWeaknesses: StrengthWeakness[];       // S&W analysis
  swotAnalysis: SwotData;                        // SWOT analysis
  actionablePrescription: ActionablePrescriptionItem[]; // 5-element concrete strategies
  conclusion: string;                            // Summary
  // Phase 0: New fields for enhanced analysis
  learningHabits?: LearningHabit[];      // Observed good/bad habits
  riskFactors?: RiskFactor[];            // Potential risks to growth
  growthPredictions?: GrowthPrediction[]; // Future score predictions
}
```

### Weekly Report
```typescript
interface WeeklyReportData {
  id?: number;
  period: string;
  studentName: string;
  studentGrade: string;
  learningDates: string[];
  teacherNotes: string;
  keywords: string[];
  learningContent: { topic: string; evaluation: 'excellent' | 'good' | 'not_good' }[];
  analysis: { totalProblems: number; correctProblems: number; topicUnderstanding: [...] };
  achievements: string[];
  improvements: string[];
  reviewProblems: { source: string; page: string; number: string }[];
  nextWeekPlan: { goal: string; plan: string }[];
  teacherComment: string;
}
```

### Monthly Report
```typescript
interface MonthlyReportData {
  period: string; // YYYY-MM
  studentName: string;
  announcements: string;
  cost: string;
  schedule: { year: number; month: number };
  classDates: string[];  // YYYY-MM-DD format
  classNotes: string;
  textbookCompletion: { percentage: number; description: string };
  learningContent: [...];
  whatWentWell: string[];
  needsImprovement: string[];
  reviewProblems: { source: string; page: string; number: string; concept: string }[];
  nextMonthGoals: string[];
  performanceSummary: string;
  improvementPlan: string;
  messageToParents: string;
}
```

### Consolidated Report
```typescript
interface ConsolidatedReportData {
  reports: [AnalysisReport, AnalysisReport];  // [older, newer]
  allReportsForStudent: AnalysisReport[];
  consolidatedQualitative: Pick<AnalysisReport, 'strengthsWeaknesses' | 'swotAnalysis' | 'improvementStrategy' | 'conclusion'>;
}
```

### Phase 0 Enhanced Types (NEW)

**MacroAnalysis with Future Vision**:
```typescript
interface MacroAnalysis {
  summary: string;
  strengths: string;
  weaknesses: string;
  errorPattern: string;
  // Phase 0: Future vision for structured conclusion
  futureVision?: {
    threeMonths: string;    // 3개월 후 예상 시나리오
    sixMonths: string;      // 6개월 후 목표
    longTerm: string;       // 장기 성장 경로
    encouragement: string;  // 격려 메시지
  };
  // For MobileReportView flow diagram
  weaknessFlow?: {
    step1: { title: string; description: string };
    step2: { title: string; description: string };
    step3: { title: string; description: string };
  };
  // For MobileReportView 5-axis radar chart
  mathCapability?: {
    calculationSpeed: number;     // 계산 속도 (0-100)
    calculationAccuracy: number;  // 계산 정확도 (0-100)
    applicationAbility: number;   // 응용력 (0-100)
    logic: number;                // 논리력 (0-100)
    anxietyControl: number;       // 불안 통제 (0-100)
  };
}
```

**5-Element Concrete Strategy**:
```typescript
interface ActionablePrescriptionItem {
  priority: number;           // 1=긴급, 2=중요, 3=장기
  type: '개념 교정' | '습관 교정' | '전략 개선';
  title: string;              // 전략 제목 (예: "[1순위] 부호 실수 방지 훈련")
  description: string;        // 전략 요약
  // 5-element concrete strategy (Phase 0 핵심 개선)
  whatToDo: string;           // 무엇을 (교재, 자료)
  where: string;              // 어디서 (페이지, 챕터)
  howMuch: string;            // 얼마나 (횟수, 시간)
  howTo: string;              // 어떻게 (구체적 방법)
  measurementMethod?: string; // 성과 측정 방법
  expectedEffect?: string;    // 예상 효과
}
```

**Learning Habits**:
```typescript
interface LearningHabit {
  type: 'good' | 'bad';
  description: string;
  frequency: 'always' | 'often' | 'sometimes';
}
```

**Risk Factors**:
```typescript
interface RiskFactor {
  factor: string;              // 위험 요인 (예: "풀이 과정 생략")
  severity: 'high' | 'medium' | 'low';
  recommendation: string;      // 해결 권장 사항
}
```

**Growth Predictions**:
```typescript
interface GrowthPrediction {
  timeframe: '3개월' | '6개월' | '1년';
  predictedScore: number;      // 예상 점수
  confidenceLevel: number;     // 신뢰도 (0-100)
  assumptions: string[];       // 예측 전제 조건
}
```

---

## Key Services

### 1. dbService.ts - Database Management

**Database Schema (Dexie v3):**
```typescript
students: '++id, &studentId, name'
reports: '++id, &[testInfo.studentName+testInfo.testName+testInfo.testDate], testInfo.studentName, testInfo.testDate'
weeklyReports: '++id, &[studentName+period], studentName'
```

**Key Functions:**
- `getAllStudents()` - Fetch all students ordered by name
- `getStudentByName(name)` - Find student by exact name match
- `addStudent(studentData)` - Create new student with auto-generated ID
- `updateStudent(student)` - Update existing student
- `deleteStudent(id)` - Delete student and associated reports
- `getAllReports()` - Fetch all test reports
- `getReportsByStudent(studentName)` - Get reports sorted by date
- `addReport(report)` - Save new test analysis report
- `updateReport(report)` - Update existing report
- `deleteReport(id)` - Remove report
- `addWeeklyReport(report)` - Save weekly report
- `getLatestWeeklyReportForStudent(studentName)` - Get most recent weekly report
- `processCsv(csvFile)` - Parse and import CSV data

**Important Notes:**
- All DB operations are async and return Promises
- Version migrations: v2 (students, reports) → v3 (added weeklyReports)
- Composite keys prevent duplicate reports: `[studentName+testName+testDate]`
- CSV import supports both student lists and test result data
- Google Sheets sync runs in background (failures logged but don't block UI)

### 2. geminiService.ts - AI Analysis Engine

**Models Used:**
- `gemini-2.5-flash` - Fast analysis and qualitative report generation

**Key Functions:**
- `generateQualitativeAnalysis(testInfo, testResults, historicalData)` - Generate S&W, SWOT, strategies, conclusion
- `generateConsolidatedAnalysis(olderReport, newerReport, allReports)` - Compare two test reports and analyze growth
- `analyzeTestPaper(images, testInfo)` - OCR and analyze test paper images for detailed problem analysis
- `generateWeeklyReport(weeklyData)` - Generate comprehensive weekly learning report
- `generateMonthlyReport(monthlyData)` - Generate monthly progress report

**Schema Structure (Phase 0 Enhanced):**
All functions use strict JSON schemas for structured output. Enhanced schemas include:

```typescript
// Deep Analysis Schema (for generateTestAnalysis)
deepAnalysisSchema = {
  detailedAnalysis: [{
    problemNumber, keyConcept, isCorrect, errorType, solutionStrategy,
    analysis  // 5가지 관점 (사고의 출발점, 풀이 과정, 실수 패턴, 문제 해석, 풀이 습관)
  }],
  macroAnalysis: {
    summary, strengths, weaknesses, errorPattern,
    futureVision: { threeMonths, sixMonths, longTerm, encouragement }  // NEW
  },
  actionablePrescription: [{
    priority, type, title, description,
    whatToDo, where, howMuch, howTo, measurementMethod, expectedEffect  // 5-element strategy (NEW)
  }],
  learningHabits: [{ type, description, frequency }],  // NEW
  riskFactors: [{ factor, severity, recommendation }],  // NEW
}

// Consolidated Analysis Schema
consolidatedAnalysisSchema = {
  macroAnalysis: { ... },
  actionablePrescription: [{ ... }],  // 5-element strategies
  growthPredictions: [{  // NEW
    timeframe, predictedScore, confidenceLevel, assumptions
  }]
}
```

**Prompt Engineering Improvements (Phase 0):**
- **5-Perspective Deep Analysis**: Every problem analyzed from 5 viewpoints (사고의 출발점, 풀이 진행, 실수 패턴, 문제 해석, 풀이 습관)
- **5-Element Concrete Strategies**: All strategies must include 무엇을, 어디서, 얼마나, 어떻게, 측정 방법
- **Future Vision**: 3개월/6개월/장기 예측 포함
- **Habit Detection**: Good/bad learning habits identification
- **Risk Factor Analysis**: Potential growth impediments
- Prompts are in Korean for better Korean-language analysis
- Emphasize "전문적인 학습 컨설턴트 관점" (professional learning consultant perspective)
- All responses use `responseMimeType: "application/json"` with enhanced schemas

**Cost Optimization:**
- Cache results in DB when possible (same input = reuse stored analysis)
- Minimize prompt length while maintaining clarity
- Use token-efficient JSON schemas

### 3. googleSheetsService.ts - Cloud Synchronization

**Purpose:** Backup student data and reports to Google Sheets

**Key Functions:**
- `syncStudentData(action, student)` - Sync student create/update/delete
- `syncReportData(action, report)` - Sync report operations
- `syncWeeklyResultData(student, period, learningDates, analysis)` - Sync weekly summaries

**Implementation:**
- Uses Google Apps Script Web App as backend endpoint
- POST requests with JSON payloads
- Runs asynchronously (failures don't block user operations)
- Error handling: logs to console, doesn't throw to UI (graceful degradation)

**Configuration:**
- Spreadsheet ID and script URL configured in `settingsService.ts`
- User can configure via Settings modal in UI

### 4. settingsService.ts - Application Settings

**Manages:**
- Google Sheets integration settings (spreadsheet ID, script URL)
- API key configuration
- Other app preferences

**Storage:** LocalStorage for persistence across sessions

---

## Development Workflow

### Setup
```bash
# Install dependencies
npm install

# Set environment variables
# Create .env.local file with:
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Configuration
- **API Key:** Required for Gemini AI features. Get from Google AI Studio
- **Vite Access:** `VITE_GEMINI_API_KEY` → `import.meta.env.VITE_GEMINI_API_KEY` (browser-compatible)

### Development Server
- Runs on `http://localhost:5173` (default Vite port)
- Hot Module Replacement (HMR) enabled
- TypeScript compilation errors shown in terminal and browser

---

## Code Conventions

### TypeScript Standards
1. **Strict Mode:** Always enabled in tsconfig.json
2. **No `any`:** Avoid `any` type. Use `unknown` if type is truly dynamic, then narrow with type guards
3. **Interface over Type:** Use `interface` for object shapes, `type` for unions/intersections
4. **Explicit Return Types:** Function return types should be explicit for complex functions
5. **Type Imports:** Use `import type { ... }` for type-only imports

### Component Structure
```typescript
// 1. Imports (React, types, services, components, icons)
import React, { useState, useEffect } from 'react';
import type { Student, AnalysisReport } from '../types';
import { getStudentByName } from '../services/dbService';
import { Card } from './Card';
import { CheckIcon } from './icons';

// 2. Interface for props (if any)
interface ComponentNameProps {
  student: Student;
  onUpdate: (report: AnalysisReport) => void;
}

// 3. Component definition
export const ComponentName: React.FC<ComponentNameProps> = ({ student, onUpdate }) => {
  // 4. State declarations
  const [loading, setLoading] = useState(false);

  // 5. Effects
  useEffect(() => {
    // effect logic
  }, [dependencies]);

  // 6. Event handlers
  const handleSubmit = async () => {
    // handler logic
  };

  // 7. Render
  return (
    <div className="...">
      {/* JSX */}
    </div>
  );
};
```

### Naming Conventions
- **Components:** PascalCase (e.g., `StudentSelector`, `ReportView`)
- **Files:** Match component name (e.g., `StudentSelector.tsx`)
- **Functions/Variables:** camelCase (e.g., `getAllStudents`, `studentData`)
- **Constants:** UPPER_SNAKE_CASE for true constants (e.g., `API_ENDPOINT`)
- **Types/Interfaces:** PascalCase (e.g., `Student`, `AnalysisReport`)
- **Services:** camelCase with descriptive names (e.g., `geminiService.ts`)

### Styling (Tailwind CSS)
- **Use Utility Classes:** Prefer Tailwind utilities over custom CSS
- **Consistency:** Maintain spacing, color, and typography scales from Tailwind config
- **Responsive Design:** Use responsive prefixes (`sm:`, `md:`, `lg:`) where needed
- **No Inline Styles:** Avoid `style={{ }}` unless dynamically computed

### Error Handling
```typescript
// DB operations
try {
  await dbService.addStudent(studentData);
  // Success feedback
} catch (error) {
  console.error('Failed to add student:', error);
  // User-friendly error message
  alert(`오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
}

// Gemini API calls
try {
  const analysis = await generateQualitativeAnalysis(...);
  return analysis;
} catch (error) {
  console.error('Gemini API error:', error);
  // Fallback or retry logic
  throw new Error('AI 분석 중 오류가 발생했습니다. 다시 시도해주세요.');
}
```

### Data Validation
- **Required Fields:** Check before DB operations
- **String Trimming:** Always `.trim()` user input strings
- **Number Parsing:** Use `parseInt()` / `parseFloat()` with `isNaN()` checks
- **Date Formatting:** Standardize to `YYYY-MM-DD` for consistency

---

## Common Tasks

### Using AppContext (Phase 0)

**AppContext provides global state management for the entire application. Use this instead of direct dbService calls in components.**

```typescript
import { useApp } from '../context/AppContext';

// In your component
export const MyComponent: React.FC = () => {
  const {
    students,
    reports,
    loading,
    error,
    addStudent,
    updateStudent,
    deleteStudent,
    addReport,
    updateReport,
    deleteReport,
    refreshData
  } = useApp();

  // Use the data and functions
  const handleAddStudent = async () => {
    try {
      await addStudent({
        name: '홍길동',
        level: 'M',
        grade: '7',
        school: 'Example Middle School',
        startDate: '2024-03-01'
      });
      // Data automatically refreshes
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div>
      {loading ? <p>Loading...</p> : null}
      {error ? <p>Error: {error}</p> : null}
      {students.map(student => (
        <div key={student.id}>{student.name}</div>
      ))}
    </div>
  );
};
```

### Adding a New Student (Legacy - Direct DB Access)
```typescript
import { addStudent } from './services/dbService';

const newStudent = {
  name: '홍길동',
  level: 'M',    // P, M, H, A
  grade: '7',
  school: 'Example Middle School',
  startDate: '2024-03-01',
  // Phase 0: Optional personalization fields
  learningStyle: 'visual',  // or 'verbal', 'logical'
  personalityTraits: ['성실함', '꼼꼼함']
};

try {
  await addStudent(newStudent);
  // studentId is auto-generated (e.g., "M2407001")
  console.log('Student added successfully');
} catch (error) {
  console.error('Error adding student:', error);
}
```

**Note:** Prefer using AppContext in components over direct dbService calls.

### Generating a Test Analysis Report
```typescript
import { generateQualitativeAnalysis } from './services/geminiService';
import { addReport } from './services/dbService';

const testInfo = { /* TestInfo data */ };
const testResults = { /* TestResults data */ };
const historicalData = { gradeTrend: [...], performanceTrend: [...] };

// Generate AI analysis
const qualitativeData = await generateQualitativeAnalysis(
  testInfo,
  testResults,
  historicalData
);

// Combine with quantitative data
const fullReport: AnalysisReport = {
  testInfo,
  testResults,
  resultAnalysis: { /* ResultAnalysis data */ },
  ...qualitativeData
};

// Save to database
const reportId = await addReport(fullReport);
console.log('Report saved with ID:', reportId);
```

### Importing CSV Data
```typescript
import { processCsv } from './services/dbService';

const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const result = await processCsv(file);
    console.log(`Imported ${result.students} students, ${result.reports} reports`);
  } catch (error) {
    console.error('CSV import failed:', error);
  }
};
```

### Exporting Report as PDF
```typescript
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const exportToPdf = async (elementId: string, fileName: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  // Capture element as canvas
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false
  });

  // Convert to PDF
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(`${fileName}.pdf`);
};
```

### Querying Reports by Student
```typescript
import { getReportsByStudent } from './services/dbService';

const studentReports = await getReportsByStudent('홍길동');
// Returns reports sorted by testInfo.testDate (ascending)

// Filter for specific date range
const recentReports = studentReports.filter(report =>
  new Date(report.testInfo.testDate) >= new Date('2024-01-01')
);
```

---

## AI Integration

### Gemini API Usage Patterns

**1. Structured Output with JSON Schema**
```typescript
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseSchema: yourSchema
  }
});

const result = JSON.parse(response.text);
```

**2. Prompt Design for Analysis**
- **Context First:** Provide test info, results, historical data
- **Clear Requirements:** Specify exact output format and content
- **Professional Tone:** Request "전문적인 입시 컨설턴트 관점"
- **Actionable Focus:** Emphasize "구체적인" (specific) recommendations
- **Korean Language:** All prompts and responses in Korean for better quality

**3. Error Handling**
```typescript
try {
  const response = await ai.models.generateContent({...});
  if (!response || !response.text) {
    throw new Error('Empty response from Gemini');
  }
  const parsed = JSON.parse(response.text);
  // Validate schema
  if (!parsed.strengthsWeaknesses || !parsed.swotAnalysis) {
    throw new Error('Invalid response structure');
  }
  return parsed;
} catch (error) {
  console.error('Gemini analysis failed:', error);
  // Return fallback or throw user-friendly error
}
```

**4. Cost Optimization Strategies**
- **Cache Results:** Store AI-generated analysis in DB, reuse when possible
- **Batch Requests:** Analyze multiple items in one request when appropriate
- **Token Reduction:** Remove unnecessary examples/context from prompts
- **Model Selection:** Use `gemini-2.5-flash` for balance of speed and quality

**5. Image Analysis (OCR)**
```typescript
// For test paper analysis
const images = [file1, file2]; // File objects or base64 strings
const analysis = await analyzeTestPaper(images, testInfo);
// Returns detailed problem-by-problem analysis
```

---

## Testing and Build

### Development Testing
```bash
# Run dev server with hot reload
npm run dev

# Access at http://localhost:5173
# Test features:
# 1. Student CRUD operations
# 2. Report generation (weekly, monthly, test, consolidated)
# 3. CSV import
# 4. PDF export
# 5. Google Sheets sync (if configured)
```

### Production Build
```bash
# TypeScript compilation + Vite build
npm run build

# Output to /dist folder
# Preview production build locally
npm run preview
```

### Manual Testing Checklist
- [ ] Add/edit/delete student
- [ ] Generate each report type
- [ ] Import CSV (students and reports)
- [ ] Export report as PDF
- [ ] Verify data persistence (reload page)
- [ ] Check Gemini API integration
- [ ] Test Google Sheets sync (if enabled)
- [ ] Responsive design on mobile/tablet
- [ ] Error handling (invalid inputs, API failures)

### Browser Compatibility
- **Target:** Modern browsers (Chrome, Firefox, Safari, Edge - latest 2 versions)
- **IndexedDB:** Required for Dexie.js (check browser support)
- **Canvas API:** Required for html2canvas (PDF export)

---

## Optimization Considerations

### Performance Optimization

**1. Rendering Optimization**
- **Code Splitting:** Lazy load heavy components (Recharts, report generators)
```typescript
const ReportView = React.lazy(() => import('./components/ReportView'));
```
- **Memoization:** Use `React.memo` for expensive components
```typescript
export const ExpensiveChart = React.memo(({ data }) => {
  // Chart rendering
}, (prevProps, nextProps) => prevProps.data === nextProps.data);
```
- **List Keys:** Ensure unique, stable keys for list items
```typescript
{reports.map(report => (
  <ReportCard key={report.id} report={report} />
))}
```

**2. Memory Management**
- **Image Optimization:** Resize uploaded images before processing
- **Canvas Cleanup:** Clear canvas references after PDF generation
```typescript
// After html2canvas and PDF generation
canvas.remove();
canvas = null;
```
- **Event Listener Cleanup:** Remove listeners in useEffect cleanup
```typescript
useEffect(() => {
  const handler = () => { /* ... */ };
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);
```

**3. API Efficiency**
- **Caching Strategy:** Check DB before making Gemini API calls
```typescript
// Check if analysis exists for this test
const existing = await getReportsByStudent(studentName)
  .find(r => r.testInfo.testName === testName && r.testInfo.testDate === testDate);
if (existing) return existing; // Use cached
// Otherwise, call Gemini API
```
- **Debouncing:** For auto-save or search features
```typescript
const debouncedSave = debounce(saveFunction, 1000);
```

### Code Quality

**1. Type Safety**
- Avoid `any` type - use `unknown` or specific types
- Add return type annotations for public functions
- Use type guards for runtime type checking
```typescript
function isAnalysisReport(obj: unknown): obj is AnalysisReport {
  return typeof obj === 'object' && obj !== null && 'testInfo' in obj;
}
```

**2. Component Decoupling**
- Keep components pure (no direct API calls in components)
- Move business logic to services
- Use custom hooks for shared stateful logic
```typescript
// Good: Custom hook
const useStudentData = (studentName: string) => {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudentByName(studentName).then(setStudent).finally(() => setLoading(false));
  }, [studentName]);

  return { student, loading };
};
```

**3. Error Boundaries**
- Implement error boundaries for component error handling
```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error('Component error:', error, errorInfo);
  }
  render() {
    return this.props.children;
  }
}
```

### Database Considerations

**1. Dexie Version Management**
- When updating schema, increment version number
- Provide migration logic for existing data
```typescript
(this as Dexie).version(4).stores({
  // New schema
}).upgrade(tx => {
  // Migration logic for v3 → v4
  return tx.students.toCollection().modify(student => {
    // Update student structure
  });
});
```

**2. Query Optimization**
- Use indexed fields for queries (defined in schema)
- Avoid loading all records when filtering is possible
```typescript
// Good: Use index
db.reports.where('testInfo.studentName').equals(name).toArray();

// Avoid: Load all then filter in JS
const all = await db.reports.toArray();
const filtered = all.filter(r => r.testInfo.studentName === name);
```

### Future Enhancements to Consider
- **Context API / Zustand:** Replace prop drilling for global state
- **Unit Testing:** Add tests for services (Jest + Testing Library)
- **PWA Features:** Offline support, install prompt
- **Backend Migration:** Move from IndexedDB to server DB for multi-device sync
- **Accessibility:** ARIA labels, keyboard navigation, screen reader support

---

## Working with This Codebase - Quick Reference

### When Adding Features
1. Check if feature aligns with core purpose (student growth tracking)
2. Define types in `types.ts` first
3. Implement business logic in appropriate service file
4. Create/update components in `src/components/`
5. Avoid feature creep - keep it simple and focused

### When Fixing Bugs
1. Identify which layer has the issue (UI, Service, DB)
2. Check TypeScript errors first (`npm run build`)
3. Review recent changes in `git log`
4. Test fix across different report types
5. Ensure data integrity in IndexedDB

### When Refactoring
1. Maintain backward compatibility for DB schema
2. Update types if data structures change
3. Keep existing prompts in `geminiService.ts` unless improving quality
4. Run full manual test checklist after refactoring
5. Document breaking changes in commit message

### Code Review Checklist
- [ ] TypeScript strict mode passes
- [ ] No `any` types introduced
- [ ] Error handling implemented
- [ ] User input validated and trimmed
- [ ] Tailwind CSS used (no inline styles)
- [ ] Component follows standard structure
- [ ] No console.logs in production code (use for debugging only)
- [ ] Props documented if component is reusable
- [ ] Async operations have proper error handling

---

## Git Workflow

### Branch Naming
- Feature branches: `claude/claude-md-{random-id}-{session-id}`
- Always work on designated branch (check instructions at conversation start)

### Commit Messages
- **Format:** `{type}: {concise description}`
- **Types:** `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`
- **Examples:**
  - `feat: Add consolidated report generation`
  - `fix: Resolve CSV import date parsing issue`
  - `refactor: Extract chart components from ReportView`
  - `docs: Update CLAUDE.md with AI integration guide`

### Push Protocol
```bash
# Always use -u flag for first push
git push -u origin claude/claude-md-{random-id}-{session-id}

# Retry on network failures (up to 4 times with exponential backoff)
# 2s → 4s → 8s → 16s
```

### Pull Request Guidelines
1. Summarize all commits in PR description
2. Mention related issues/tasks
3. Include test plan checklist
4. Request review before merge

---

## Additional Resources

### Documentation Files
- **README.md** - Quick start and deployment guide
- **PRD.md** - Product requirements (Korean)
- **PROJECT_GUIDE.md** - Technical structure (Korean)
- **QA_AND_OPTIMIZATION.md** - Quality assurance plan (Korean)

### External Documentation
- [React 19 Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Dexie.js Guide](https://dexie.org/)
- [Gemini API Reference](https://ai.google.dev/docs)
- [Recharts Documentation](https://recharts.org/)

### Troubleshooting
- **Gemini API 400 Error:** Check API key, prompt format, schema validity
- **Dexie "not found" error:** Ensure database version migrations ran correctly
- **PDF export blank:** Check element visibility, canvas rendering settings
- **Google Sheets sync fails:** Verify script URL, spreadsheet permissions
- **TypeScript errors after update:** Run `npm install` to update types

---

## Final Notes for AI Assistants

**Remember the Core Purpose:**
Every line of code should contribute to helping students grow through data-driven insights. Avoid adding features that don't directly serve this mission.

**Prioritize Data Integrity:**
Student progress data is critical. Always handle DB operations with care, validate inputs, and ensure backward compatibility.

**Keep It Simple:**
Don't over-engineer. Three lines of clear code are better than a premature abstraction. The codebase should remain accessible to human developers.

**AI is a Tool, Not the Product:**
Gemini API provides analysis, but the real value is in data continuity, visualization, and actionable recommendations. Don't rely solely on AI - human teacher insights are irreplaceable.

**User Experience Matters:**
Teachers and parents need fast, reliable, clear reports. Performance optimization and error handling directly impact users' ability to help students.

---

**Last Updated:** 2025-11-25
**Codebase Version:** Current as of commit `9fb44a6`
**For questions or clarifications, refer to existing documentation or analyze the source code directly.**
