'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@/types';

// 컴포넌트 로컬 타입 (DB JOIN 결과에 최적화)
interface CommentAuthor {
  name: string;
  role: string;
}

interface CommentWithAuthor {
  id: number;
  report_id: number;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: CommentAuthor;
}


interface ReportCommentsProps {
  reportId: number;
  currentUser: User;
}

/**
 * ReportComments - 리포트 단위 교사-학부모 코멘트 스레드
 *
 * 특정 AI 분석 리포트에 교사의 현장 의견과 학부모의 피드백을 실시간으로 주고받는 컴포넌트.
 * - 교사(파란색 계열) / 학부모(보라색 계열) 말풍선 구분
 * - Glassmorphism + 그라데이션 프리미엄 디자인
 * - CSS transitions 기반 부드러운 마이크로 인터랙션
 */
export default function ReportComments({ reportId, currentUser }: ReportCommentsProps) {
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('report_comments')
      .select(`
        id,
        report_id,
        author_id,
        content,
        created_at,
        updated_at,
        users:author_id (
          id,
          name,
          role
        )
      `)
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      const mapped = data.map((c: Record<string, unknown>) => ({
        id: c.id as number,
        report_id: c.report_id as number,
        author_id: c.author_id as string,
        content: c.content as string,
        created_at: c.created_at as string,
        updated_at: c.updated_at as string,
        author: Array.isArray(c.users)
          ? (c.users[0] as { name: string; role: string } | undefined)
          : (c.users as { name: string; role: string } | undefined),
      }));
      setComments(mapped);
    }
    setLoading(false);
  }, [reportId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    if (isExpanded) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [comments, isExpanded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from('report_comments')
      .insert({
        report_id: reportId,
        author_id: currentUser.id,
        content: trimmed,
      })
      .select(`
        id,
        report_id,
        author_id,
        content,
        created_at,
        updated_at,
        users:author_id (id, name, role)
      `)
      .single();

    if (!error && data) {
      const raw = data as Record<string, unknown>;
      const newEntry = {
        id: raw.id as number,
        report_id: raw.report_id as number,
        author_id: raw.author_id as string,
        content: raw.content as string,
        created_at: raw.created_at as string,
        updated_at: raw.updated_at as string,
        author: Array.isArray(raw.users)
          ? (raw.users[0] as { name: string; role: string } | undefined)
          : (raw.users as { name: string; role: string } | undefined),
      };
      setComments(prev => [...prev, newEntry]);
      setNewComment('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
    setSubmitting(false);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewComment(e.target.value);
    // 자동 높이 조절
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}시간 전`;
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const isTeacher = (role?: string) => role === 'teacher';
  const isMe = (authorId: string) => authorId === currentUser.id;

  return (
    <div className="mt-8">
      {/* 섹션 헤더 */}
      <button
        onClick={() => setIsExpanded(prev => !prev)}
        className="w-full flex items-center justify-between p-5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 group"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
            💬
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-800 text-sm">선생님 · 학부모 소통</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {loading ? '불러오는 중...' : `코멘트 ${comments.length}개`}
            </p>
          </div>
        </div>
        <span
          className={`text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {/* 코멘트 스레드 */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[600px] opacity-100 mt-3' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* 말풍선 목록 */}
          <div className="p-5 space-y-4 max-h-80 overflow-y-auto scroll-smooth">
            {loading && (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!loading && comments.length === 0 && (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-xl">
                  ✉️
                </div>
                <p className="text-sm text-gray-400">아직 코멘트가 없습니다.</p>
                <p className="text-xs text-gray-300 mt-1">첫 번째 메시지를 남겨보세요!</p>
              </div>
            )}

            {comments.map((comment) => {
              const isMine = isMe(comment.author_id);
              const authorIsTeacher = isTeacher(comment.author?.role);

              return (
                <div
                  key={comment.id}
                  className={`flex gap-3 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                  style={{ animation: 'fadeSlideIn 0.25s ease-out' }}
                >
                  {/* 아바타 */}
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm ${
                      authorIsTeacher
                        ? 'bg-gradient-to-br from-blue-500 to-blue-700'
                        : 'bg-gradient-to-br from-violet-500 to-purple-700'
                    }`}
                  >
                    {(comment.author?.name ?? '?').charAt(0)}
                  </div>

                  {/* 말풍선 */}
                  <div className={`flex flex-col gap-1 max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-gray-500">
                        {comment.author?.name ?? '알 수 없음'}
                      </span>
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          authorIsTeacher
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-violet-50 text-violet-600'
                        }`}
                      >
                        {authorIsTeacher ? '선생님' : '학부모'}
                      </span>
                    </div>

                    <div
                      className={`relative px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                        isMine
                          ? authorIsTeacher
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm'
                            : 'bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-tr-sm'
                          : 'bg-gray-50 text-gray-800 border border-gray-100 rounded-tl-sm'
                      }`}
                    >
                      {comment.content}
                    </div>

                    <span className="text-[10px] text-gray-300 px-1">
                      {formatTime(comment.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* 구분선 */}
          <div className="h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent" />

          {/* 입력 영역 */}
          <form onSubmit={handleSubmit} className="p-4">
            <div className="flex gap-3 items-end">
              {/* 내 아바타 */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm ${
                  isTeacher(currentUser.role)
                    ? 'bg-gradient-to-br from-blue-500 to-blue-700'
                    : 'bg-gradient-to-br from-violet-500 to-purple-700'
                }`}
              >
                {(currentUser.name ?? '?').charAt(0)}
              </div>

              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={newComment}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isTeacher(currentUser.role)
                      ? '현장 의견을 남겨주세요... (Enter로 전송, Shift+Enter로 줄바꿈)'
                      : '피드백을 남겨주세요... (Enter로 전송)'
                  }
                  rows={1}
                  className="w-full resize-none px-4 py-3 pr-12 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-150 placeholder:text-gray-300 leading-relaxed"
                  style={{ maxHeight: '120px' }}
                  disabled={submitting}
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || submitting}
                  className={`absolute right-3 bottom-3 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 ${
                    newComment.trim() && !submitting
                      ? isTeacher(currentUser.role)
                        ? 'bg-blue-500 text-white shadow-sm hover:bg-blue-600 active:scale-95'
                        : 'bg-violet-500 text-white shadow-sm hover:bg-violet-600 active:scale-95'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                  aria-label="전송"
                >
                  {submitting ? (
                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
