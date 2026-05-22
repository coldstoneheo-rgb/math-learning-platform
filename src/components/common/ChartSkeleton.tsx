import React from 'react';

interface ChartSkeletonProps {
  height?: number | string;
  className?: string;
}

export default function ChartSkeleton({ height = 300, className = '' }: ChartSkeletonProps) {
  return (
    <div
      className={`w-full flex items-center justify-center bg-gray-50 rounded-xl border border-gray-100 animate-pulse ${className}`}
      style={{ height }}
    >
      <div className="flex flex-col items-center gap-3">
        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span className="text-sm font-medium text-gray-400">차트 데이터를 불러오는 중...</span>
      </div>
    </div>
  );
}
