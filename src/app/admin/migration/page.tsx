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

export default function MigrationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const { toasts, addToast, removeToast } = useToast();
  
  const [tasks, setTasks] = useState<MigrationTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 일괄 설정용 상태
  const [batchDate, setBatchDate] = useState('');
  const [batchType, setBatchType] = useState('시험지');

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
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-8 rounded-r-lg">
          <h3 className="font-bold text-blue-800">타임머신 학습 엔진 안내</h3>
          <p className="text-blue-700 text-sm mt-1">
            과거의 시험지, PDF 리포트, 일일 문제풀이 이미지 등을 업로드하면 AI가 순차적으로 과거의 성장 궤적을 학습하여 
            현재 학생의 메타프로필(Meta-Profile)을 업데이트합니다. 이 과정은 리포트를 렌더링하지 않고 핵심 시그널만 DB에 누적 압축 보관합니다.
          </p>
        </div>

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
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full py-8 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-500 hover:text-indigo-600 transition-colors disabled:opacity-50 flex flex-col items-center justify-center gap-2"
              >
                <span className="text-2xl">📁</span>
                <span>클릭하여 이미지/PDF 추가</span>
              </button>
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
      </main>
    </div>
  );
}
