'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface AuthErrorToastProps {
  message?: string;
  onClose?: () => void;
}

export default function AuthErrorToast({ message, onClose }: AuthErrorToastProps) {
  const [visible, setVisible] = useState(false);
  const [displayMessage, setDisplayMessage] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // URL 파라미터에서 에러 확인
    const errorParam = searchParams.get('error');

    if (errorParam === 'session_expired') {
      setDisplayMessage('세션이 만료되었습니다. 다시 로그인해 주세요.');
      setVisible(true);

      // URL에서 error 파라미터 제거
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('error');
      const newUrl = newParams.toString()
        ? `${window.location.pathname}?${newParams.toString()}`
        : window.location.pathname;
      router.replace(newUrl);
    } else if (message) {
      setDisplayMessage(message);
      setVisible(true);
    }
  }, [searchParams, message, router]);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div className="bg-amber-50 border border-amber-200 rounded-lg shadow-lg p-4 flex items-start gap-3 max-w-md">
        <div className="flex-shrink-0">
          <svg
            className="w-5 h-5 text-amber-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800">{displayMessage}</p>
        </div>
        <button
          onClick={() => {
            setVisible(false);
            onClose?.();
          }}
          className="flex-shrink-0 text-amber-400 hover:text-amber-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
