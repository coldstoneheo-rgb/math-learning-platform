'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Student } from '@/types';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Toast from '@/components/common/Toast';
import { useToast } from '@/hooks/useToast';
import { v4 as uuidv4 } from 'uuid';
import { processMigrationTask, type MigrationTask } from '@/lib/migration-engine';

type ActiveTab = 'ai-ingest' | 'csv-import';

// CSV 업로드 유효성 오류 타입
interface CsvValidationError {
  rowIndex: number;
  field: string;
  message: string;
}

// CSV 템플릿 다운로드
function downloadCsvTemplate() {
  const headers = 'student_id,test_date,test_name,total_score,max_score,rank,total_students';
  const example = 'M1250103,2025-03-15,2025년 1학기 중간고사,85,100,5,30';
  const example2 = 'M1250103,2025-06-20,2025년 1학기 기말고사,92,100,3,30';
  const csv = [headers, example, example2].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'migration_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function MigrationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const { toasts, addToast, removeToast } = useToast();

  // 탭 상태
  const [activeTab, setActiveTab] = useState<ActiveTab>('ai-ingest');

  // AI 인제스천 상태
  const [tasks, setTasks] = useState<MigrationTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // 일괄 설정용 상태
  const [batchDate, setBatchDate] = useState('');
  const [batchType, setBatchType] = useState('시험지');

  // CSV 업로드 상태
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ importedCount: number; message: string } | null>(null);
  const [csvErrors, setCsvErrors] = useState<CsvValidationError[]>([]);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role !== 'teacher') {
      router.push('/');
      return;
    }

    const { data: studentData } = await supabase
      .from('students')
      .select('id, name, grade, student_id, created_at')
      .order('name');

    if (studentData) {
      setStudents(studentData);
    }
    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const newFiles = Array.from(e.target.files);
    
    const newTasks: MigrationTask[] = newFiles.map(file => ({
      id: uuidv4(),
      file,
      documentDate: batchDate || new Date().toISOString().split('T')[0],
      documentType: batchType,
      status: 'pending',
      progress: 0
    }));

    setTasks(prev => [...prev, ...newTasks]);
    
    // reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isProcessing) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isProcessing) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter(file => 
        file.type.startsWith('image/') || file.type === 'application/pdf'
      );
      
      const newTasks: MigrationTask[] = newFiles.map(file => ({
        id: uuidv4(),
        file,
        documentDate: batchDate || new Date().toISOString().split('T')[0],
        documentType: batchType,
        status: 'pending',
        progress: 0
      }));

      setTasks(prev => [...prev, ...newTasks]);
    }
  };

  const removeTask = (id: string) => {
    if (isProcessing) return;
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const updateTaskField = (id: string, field: 'documentDate' | 'documentType', value: string) => {
    if (isProcessing) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const startMigration = async () => {
    if (!selectedStudent) {
      addToast('학생을 선택해주세요.', 'error');
      return;
    }
    if (tasks.length === 0) {
      addToast('마이그레이션할 파일을 추가해주세요.', 'error');
      return;
    }

    const student = students.find(s => s.id.toString() === selectedStudent);
    if (!student) return;

    setIsProcessing(true);
    addToast('데이터 마이그레이션을 시작합니다. 이 페이지를 닫지 마세요.', 'info');

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (task.status === 'success') continue; // 이미 성공한 건 스킵

      // 상태 업데이트: processing
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'processing', progress: 10 } : t));

      const updatedTask = await processMigrationTask(task, student.id, student.name);

      setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));

      if (updatedTask.status === 'success') successCount++;
      else errorCount++;
      
      // Vercel Serverless 부하 방지를 위해 task 간 약간의 딜레이
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsProcessing(false);
    
    if (errorCount === 0) {
      addToast(`성공적으로 ${successCount}건의 데이터를 마이그레이션했습니다!`, 'success');
    } else {
      addToast(`${successCount}건 성공, ${errorCount}건 실패했습니다. 실패 항목을 확인해주세요.`, 'error');
    }
  };

  const clearCompleted = () => {
    if (isProcessing) return;
    setTasks(prev => prev.filter(t => t.status !== 'success'));
  };

  // CSV 파일 선택
  const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setCsvFile(file);
    setCsvResult(null);
    setCsvErrors([]);
  };

  // CSV 업로드 실행
  const startCsvImport = async () => {
    if (!csvFile) {
      addToast('CSV 파일을 선택해주세요.', 'error');
      return;
    }
    setCsvImporting(true);
    setCsvResult(null);
    setCsvErrors([]);

    try {
      const formData = new FormData();
      formData.append('file', csvFile);

      const res = await fetch('/api/migration/csv-import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.validationErrors) {
          setCsvErrors(data.validationErrors);
          addToast(`유효성 오류: ${data.validationErrors.length}건을 확인해주세요.`, 'error');
        } else if (data.unmappedStudentIds) {
          addToast(`등록되지 않은 학번: ${data.unmappedStudentIds.join(', ')}`, 'error');
        } else {
          addToast(data.error || '업로드 실패', 'error');
        }
        return;
      }

      setCsvResult(data);
      setCsvFile(null);
      if (csvInputRef.current) csvInputRef.current.value = '';
      addToast(data.message, 'success');
    } catch {
      addToast('네트워크 오류가 발생했습니다.', 'error');
    } finally {
      setCsvImporting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const successCount = tasks.filter(t => t.status === 'success').length;
  const errorCount = tasks.filter(t => t.status === 'error').length;
  const totalProgress = tasks.length === 0 ? 0 : Math.round((successCount / tasks.length) * 100);

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast toasts={toasts} onRemove={removeToast} />
      
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <a href="/admin" className="text-gray-500 hover:text-gray-700">← 대시보드</a>
            <h1 className="text-xl font-bold text-gray-900">레거시 데이터 마이그레이션 (Batch Ingestion)</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg">
          <h3 className="font-bold text-blue-800">타임머신 학습 엔진 안내</h3>
          <p className="text-blue-700 text-sm mt-1">
            과거의 시험지, PDF 리포트, 일일 문제풀이 이미지 등을 업로드하면 AI가 순차적으로 과거의 성장 궤적을 학습하여
            현재 학생의 메타프로필(Meta-Profile)을 업데이트합니다. 이 과정은 리포트를 렌더링하지 않고 핵심 시그널만 DB에 누적 압축 보관합니다.
          </p>
        </div>

        {/* 탭 전환 */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('ai-ingest')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'ai-ingest'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🤖 AI 인제스천 (이미지/PDF)
          </button>
          <button
            onClick={() => setActiveTab('csv-import')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'csv-import'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📊 CSV 일괄 업로드 (점수 데이터)
          </button>
        </div>

        {/* ───────────── CSV 업로드 탭 ───────────── */}
        {activeTab === 'csv-import' && (
          <div className="space-y-6">
            {/* 안내 */}
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
              <h3 className="font-bold text-amber-800">CSV 일괄 업로드 안내</h3>
              <p className="text-amber-700 text-sm mt-1">
                과거 시험 점수, 석차 등 정량 데이터를 CSV로 일괄 등록합니다.
                등록된 데이터는 <strong>연간 성장 그래프</strong>에 즉시 반영됩니다. AI 분석 없이 빠르게 과거 성적 궤적을 복원할 수 있습니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 좌측: 템플릿 & 업로드 */}
              <div className="space-y-4">
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-lg font-bold mb-3">① 템플릿 다운로드</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    아래 버튼으로 표준 CSV 템플릿을 다운로드한 뒤 Excel 또는 Numbers에서 작성하세요.
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-600 mb-4 overflow-x-auto">
                    <div className="font-bold text-gray-700 mb-1">필수 열</div>
                    <div>student_id · test_date · test_name · total_score · max_score</div>
                    <div className="mt-1 text-gray-400">선택 열: rank · total_students</div>
                  </div>
                  <button
                    onClick={downloadCsvTemplate}
                    className="w-full py-2 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors text-sm font-medium"
                  >
                    📥 migration_template.csv 다운로드
                  </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-lg font-bold mb-3">② CSV 파일 업로드</h2>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCsvSelect}
                    className="hidden"
                    disabled={csvImporting}
                  />
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    disabled={csvImporting}
                    className="w-full py-8 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-500 hover:text-indigo-600 transition-colors disabled:opacity-50 flex flex-col items-center gap-2"
                  >
                    <span className="text-2xl">📄</span>
                    <span className="text-sm">
                      {csvFile ? csvFile.name : '클릭하여 CSV 파일 선택'}
                    </span>
                    {csvFile && (
                      <span className="text-xs text-gray-400">
                        {(csvFile.size / 1024).toFixed(1)} KB
                      </span>
                    )}
                  </button>

                  <button
                    onClick={startCsvImport}
                    disabled={!csvFile || csvImporting}
                    className="mt-4 w-full py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {csvImporting ? '⏳ 업로드 중...' : '🚀 CSV 데이터 가져오기'}
                  </button>
                </div>
              </div>

              {/* 우측: 결과 / 오류 / 예시 */}
              <div className="space-y-4">
                {/* 성공 결과 */}
                {csvResult && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">✅</span>
                      <h3 className="font-bold text-green-800">업로드 완료</h3>
                    </div>
                    <p className="text-green-700 text-sm">{csvResult.message}</p>
                    <p className="text-green-600 text-xs mt-2">
                      연간 성장 그래프에서 추가된 데이터를 확인할 수 있습니다.
                    </p>
                  </div>
                )}

                {/* 유효성 오류 */}
                {csvErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                    <h3 className="font-bold text-red-800 mb-3">
                      ⚠️ 유효성 오류 ({csvErrors.length}건)
                    </h3>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {csvErrors.map((err, i) => (
                        <div key={i} className="text-xs bg-white rounded p-2 border border-red-100">
                          <span className="font-semibold text-red-700">{err.rowIndex}행 [{err.field}]</span>
                          <span className="text-red-600 ml-1">{err.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CSV 형식 예시 */}
                {!csvResult && csvErrors.length === 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="font-bold text-gray-800 mb-3">📋 CSV 형식 예시</h3>
                    <div className="overflow-x-auto">
                      <table className="text-xs w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            {['student_id', 'test_date', 'test_name', 'total_score', 'max_score', 'rank', 'total_students'].map(h => (
                              <th key={h} className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-600">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-gray-200 px-2 py-1 text-indigo-600">M1250103</td>
                            <td className="border border-gray-200 px-2 py-1">2025-03-15</td>
                            <td className="border border-gray-200 px-2 py-1">중간고사</td>
                            <td className="border border-gray-200 px-2 py-1 text-center">85</td>
                            <td className="border border-gray-200 px-2 py-1 text-center">100</td>
                            <td className="border border-gray-200 px-2 py-1 text-center text-gray-400">5</td>
                            <td className="border border-gray-200 px-2 py-1 text-center text-gray-400">30</td>
                          </tr>
                          <tr className="bg-gray-50/50">
                            <td className="border border-gray-200 px-2 py-1 text-indigo-600">M1250104</td>
                            <td className="border border-gray-200 px-2 py-1">2025-03-15</td>
                            <td className="border border-gray-200 px-2 py-1">중간고사</td>
                            <td className="border border-gray-200 px-2 py-1 text-center">72</td>
                            <td className="border border-gray-200 px-2 py-1 text-center">100</td>
                            <td className="border border-gray-200 px-2 py-1 text-center text-gray-400">12</td>
                            <td className="border border-gray-200 px-2 py-1 text-center text-gray-400">30</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                      * student_id는 학생 관리 페이지의 학번과 일치해야 합니다.<br />
                      * rank, total_students는 생략 가능합니다.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ───────────── AI 인제스천 탭 ───────────── */}
        {activeTab === 'ai-ingest' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 좌측 패널: 설정 및 업로드 */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold mb-4">1. 대상 학생 선택</h2>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                disabled={isProcessing}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-gray-100"
              >
                <option value="">학생을 선택하세요</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.student_id})</option>
                ))}
              </select>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold mb-4">2. 파일 일괄 설정</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">기본 지정 날짜 (과거)</label>
                  <input
                    type="date"
                    value={batchDate}
                    onChange={(e) => setBatchDate(e.target.value)}
                    disabled={isProcessing}
                    className="w-full px-4 py-2 border rounded-lg disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">데이터 소스 유형</label>
                  <select
                    value={batchType}
                    onChange={(e) => setBatchType(e.target.value)}
                    disabled={isProcessing}
                    className="w-full px-4 py-2 border rounded-lg bg-white disabled:bg-gray-100"
                  >
                    <option value="시험지">시험지/평가문제</option>
                    <option value="월간리포트">월간/반기 리포트</option>
                    <option value="일일학습">일일학습/문제풀이노트</option>
                    <option value="스프레드시트">구형 데이터(스프레드시트 등)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold mb-4">3. 파일 업로드</h2>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                disabled={isProcessing}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full py-8 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
                  isDragging 
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                    : 'border-gray-300 text-gray-500 hover:border-indigo-500 hover:text-indigo-600'
                } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <span className="text-2xl">📁</span>
                <span>클릭하거나 파일을 이곳에 드래그하여 추가하세요</span>
              </div>
            </div>
          </div>

          {/* 우측 패널: 작업 큐 */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col h-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">마이그레이션 대기열 ({tasks.length})</h2>
                <div className="flex gap-2">
                  <button
                    onClick={clearCompleted}
                    disabled={isProcessing || successCount === 0}
                    className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
                  >
                    완료 항목 지우기
                  </button>
                  <button
                    onClick={startMigration}
                    disabled={isProcessing || tasks.length === 0 || !selectedStudent}
                    className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {isProcessing ? '처리 중...' : '마이그레이션 시작'}
                  </button>
                </div>
              </div>

              {/* 전체 프로그레스 바 */}
              {tasks.length > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">진행 상황</span>
                    <span className="font-bold text-indigo-600">{totalProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${totalProgress}%` }}></div>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>대기: {pendingCount}</span>
                    <span className="text-green-600">성공: {successCount}</span>
                    <span className="text-red-600">실패: {errorCount}</span>
                  </div>
                </div>
              )}

              {/* 파일 목록 */}
              <div className="flex-1 overflow-y-auto space-y-3 min-h-[400px]">
                {tasks.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    추가된 파일이 없습니다. 좌측 패널에서 파일을 추가해주세요.
                  </div>
                ) : (
                  tasks.map((task, index) => (
                    <div 
                      key={task.id} 
                      className={`border rounded-lg p-3 ${
                        task.status === 'success' ? 'bg-green-50 border-green-200' :
                        task.status === 'error' ? 'bg-red-50 border-red-200' :
                        task.status === 'processing' ? 'bg-blue-50 border-blue-200 border-l-4 border-l-blue-500' :
                        'bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 mr-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 truncate max-w-[200px]" title={task.file.name}>
                              {index + 1}. {task.file.name}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                              {(task.file.size / 1024 / 1024).toFixed(1)}MB
                            </span>
                          </div>
                          
                          {/* 개별 설정 폼 */}
                          {task.status === 'pending' && (
                            <div className="flex gap-2 mt-2">
                              <input 
                                type="date" 
                                value={task.documentDate}
                                onChange={(e) => updateTaskField(task.id, 'documentDate', e.target.value)}
                                className="text-xs px-2 py-1 border rounded"
                              />
                              <select 
                                value={task.documentType}
                                onChange={(e) => updateTaskField(task.id, 'documentType', e.target.value)}
                                className="text-xs px-2 py-1 border rounded bg-white"
                              >
                                <option value="시험지">시험지</option>
                                <option value="월간리포트">월간리포트</option>
                                <option value="일일학습">일일학습</option>
                                <option value="스프레드시트">스프레드시트</option>
                              </select>
                            </div>
                          )}

                          {/* 결과 / 에러 메시지 */}
                          {task.status === 'success' && task.extractedSignals && (
                            <div className="mt-2 text-xs text-green-700 bg-green-100/50 p-2 rounded">
                              <span className="font-bold">✨ 추출된 시그널:</span>
                              <ul className="list-disc list-inside mt-1">
                                {task.extractedSignals.map((sig, i) => (
                                  <li key={i} className="mb-1">
                                    <span className="font-semibold px-1 bg-green-200 rounded mr-1">
                                      {sig.affectedPillars.join(', ')}
                                    </span>
                                    {sig.insight}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {task.status === 'error' && (
                            <div className="mt-2 text-xs text-red-600 bg-red-100/50 p-2 rounded">
                              ⚠️ {task.errorMsg}
                            </div>
                          )}
                        </div>

                        {/* 우측 컨트롤 / 상태 표시 */}
                        <div className="flex flex-col items-end gap-2">
                          {task.status === 'pending' && (
                            <button 
                              onClick={() => removeTask(task.id)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              ✕
                            </button>
                          )}
                          {task.status === 'processing' && (
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          )}
                          {task.status === 'success' && <span className="text-green-600">✓ 완료</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        )}

      </main>
    </div>
  );
}
