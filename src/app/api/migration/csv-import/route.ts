import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireTeacherOrSuperAdmin } from '@/lib/api-auth';
import Papa from 'papaparse';

export const dynamic = 'force-dynamic';

// CSV 행 타입
interface CsvRow {
  student_id: string;   // 학번 (예: M1250103)
  test_date: string;    // YYYY-MM-DD
  test_name: string;    // 시험명
  total_score: string;  // 점수 (숫자 문자열)
  max_score: string;    // 만점 (숫자 문자열)
  rank?: string;        // 석차 (optional)
  total_students?: string; // 전체 학생수 (optional)
}

// 유효성 검사 결과
interface ValidationResult {
  rowIndex: number;
  field: string;
  message: string;
}

function buildCsvImportKey(studentId: number | string, testDate: string, testName: string) {
  return `${studentId}::${testDate.trim()}::${testName.trim()}`;
}

function validateRow(row: CsvRow, rowIndex: number): ValidationResult[] {
  const errors: ValidationResult[] = [];

  if (!row.student_id?.trim()) {
    errors.push({ rowIndex, field: 'student_id', message: '학번이 비어있습니다.' });
  }
  if (!row.test_date?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(row.test_date.trim())) {
    errors.push({ rowIndex, field: 'test_date', message: '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)' });
  }
  if (!row.test_name?.trim()) {
    errors.push({ rowIndex, field: 'test_name', message: '시험명이 비어있습니다.' });
  }

  const score = Number(row.total_score);
  const maxScore = Number(row.max_score);

  if (isNaN(score) || score < 0) {
    errors.push({ rowIndex, field: 'total_score', message: '점수가 유효하지 않습니다.' });
  }
  if (isNaN(maxScore) || maxScore <= 0) {
    errors.push({ rowIndex, field: 'max_score', message: '만점이 유효하지 않습니다.' });
  }
  if (!isNaN(score) && !isNaN(maxScore) && score > maxScore) {
    errors.push({ rowIndex, field: 'total_score', message: `점수(${score})가 만점(${maxScore})을 초과합니다.` });
  }

  return errors;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const auth = await requireTeacherOrSuperAdmin(supabase);
    if (!auth.ok) return auth.response;

    // FormData에서 CSV 파일 추출
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'CSV 파일이 없습니다.' }, { status: 400 });
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'CSV 파일만 업로드 가능합니다.' }, { status: 400 });
    }

    const csvText = await file.text();

    // PapaParse로 CSV 파싱
    const parseResult = Papa.parse<CsvRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
    });

    if (parseResult.errors.length > 0) {
      return NextResponse.json({
        error: 'CSV 파싱 오류',
        details: parseResult.errors.map(e => e.message),
      }, { status: 400 });
    }

    const rows = parseResult.data;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV 데이터가 비어있습니다.' }, { status: 400 });
    }

    // 전체 유효성 검사
    const allErrors: ValidationResult[] = [];
    rows.forEach((row, i) => {
      const errors = validateRow(row, i + 2); // 헤더가 1행이므로 2부터
      allErrors.push(...errors);
    });

    if (allErrors.length > 0) {
      return NextResponse.json({
        error: '데이터 유효성 검사 실패',
        validationErrors: allErrors,
      }, { status: 422 });
    }

    // 학번 → student DB ID 매핑 조회
    const studentIds = [...new Set(rows.map(r => r.student_id.trim()))];
    const { data: students, error: studentErr } = await supabase
      .from('students')
      .select('id, student_id')
      .in('student_id', studentIds);

    if (studentErr || !students) {
      return NextResponse.json({ error: '학생 정보를 불러올 수 없습니다.' }, { status: 500 });
    }

    const studentMap = new Map(students.map(s => [s.student_id, s.id]));

    // 매핑 안 된 학번 확인
    const unmappedIds = studentIds.filter(id => !studentMap.has(id));
    if (unmappedIds.length > 0) {
      return NextResponse.json({
        error: '등록되지 않은 학번이 있습니다.',
        unmappedStudentIds: unmappedIds,
      }, { status: 422 });
    }

    const mappedRows = rows.map(row => ({
      row,
      studentDbId: studentMap.get(row.student_id.trim())!,
    }));

    const mappedStudentDbIds = [...new Set(mappedRows.map(({ studentDbId }) => studentDbId))];
    const testDates = [...new Set(rows.map(row => row.test_date.trim()))];

    const { data: existingReports, error: existingErr } = await supabase
      .from('reports')
      .select('id, student_id, test_date, test_name, analysis_data')
      .in('student_id', mappedStudentDbIds)
      .in('test_date', testDates)
      .eq('report_type', 'test');

    if (existingErr) {
      console.error('CSV import duplicate check error:', existingErr);
      return NextResponse.json({ error: '기존 CSV 데이터를 확인하는 중 오류가 발생했습니다.', detail: existingErr.message }, { status: 500 });
    }

    const existingKeys = new Set(
      (existingReports ?? [])
        .filter(report => (
          typeof report.analysis_data === 'object' &&
          report.analysis_data !== null &&
          !Array.isArray(report.analysis_data) &&
          (report.analysis_data as { _importedFromCsv?: unknown })._importedFromCsv === true
        ))
        .map(report => buildCsvImportKey(report.student_id, report.test_date, report.test_name))
    );

    const duplicateRows = mappedRows.filter(({ row, studentDbId }) => (
      existingKeys.has(buildCsvImportKey(studentDbId, row.test_date, row.test_name))
    ));

    const rowsToInsert = mappedRows.filter(({ row, studentDbId }) => (
      !existingKeys.has(buildCsvImportKey(studentDbId, row.test_date, row.test_name))
    ));

    if (rowsToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        importedCount: 0,
        skippedCount: duplicateRows.length,
        message: `이미 가져온 시험 데이터 ${duplicateRows.length}건을 건너뛰었습니다.`,
      });
    }

    // reports 테이블에 일괄 삽입
    const reportInserts = rowsToInsert.map(({ row, studentDbId }) => ({
      student_id: studentDbId,
      report_type: 'test' as const,
      test_name: row.test_name.trim(),
      test_date: row.test_date.trim(),
      total_score: Number(row.total_score),
      max_score: Number(row.max_score),
      rank: row.rank ? Number(row.rank) : null,
      total_students: row.total_students ? Number(row.total_students) : null,
      analysis_data: {
        // 최소한의 필수 구조 (성장 그래프 표시용)
        testInfo: {
          testName: row.test_name.trim(),
          testDate: row.test_date.trim(),
          totalProblems: 0,
          totalScore: Number(row.max_score),
          studentScore: Number(row.total_score),
          rank: row.rank ? Number(row.rank) : undefined,
          totalStudents: row.total_students ? Number(row.total_students) : undefined,
        },
        testResults: {
          totalScore: Number(row.total_score),
          maxScore: Number(row.max_score),
          correctCount: 0,
          wrongCount: 0,
          omitCount: 0,
          scoreByCategory: [],
        },
        resultAnalysis: {
          scoreComparison: { studentTotal: Number(row.total_score), averageTotal: 0, byPoint: [] },
          attemptAnalysisByRank: [],
          gradeTrend: [],
          performanceTrend: [],
        },
        detailedAnalysis: [],
        macroAnalysis: {
          summary: `${row.test_name.trim()} 결과 데이터 (CSV 마이그레이션)`,
          strengths: '',
          weaknesses: '',
          errorPattern: '',
        },
        actionablePrescription: [],
        // CSV 마이그레이션 출처 표시
        _importedFromCsv: true,
        _importedAt: new Date().toISOString(),
      },
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from('reports')
      .insert(reportInserts)
      .select('id');

    if (insertErr) {
      console.error('CSV import insert error:', insertErr);
      return NextResponse.json({ error: '데이터 저장 중 오류가 발생했습니다.', detail: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      importedCount: inserted?.length ?? rowsToInsert.length,
      skippedCount: duplicateRows.length,
      message: duplicateRows.length > 0
        ? `${inserted?.length ?? rowsToInsert.length}건의 시험 데이터를 가져오고, 이미 있던 ${duplicateRows.length}건은 건너뛰었습니다.`
        : `${inserted?.length ?? rowsToInsert.length}건의 시험 데이터를 성공적으로 가져왔습니다.`,
    });

  } catch (error) {
    console.error('CSV import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}
