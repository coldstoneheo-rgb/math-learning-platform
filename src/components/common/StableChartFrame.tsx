'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface StableChartFrameProps {
  height: number | string;
  className?: string;
  children: ReactNode;
}

export default function StableChartFrame({
  height,
  className = '',
  children,
}: StableChartFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const updateReadyState = () => {
      const rect = frame.getBoundingClientRect();
      setIsReady(rect.width > 0 && rect.height > 0);
    };

    updateReadyState();

    const observer = new ResizeObserver(updateReadyState);
    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      className={`w-full min-w-0 ${className}`}
      style={{ height, minHeight: height }}
    >
      {isReady ? children : (
        <div className="h-full w-full rounded-lg bg-gray-50" aria-hidden="true" />
      )}
    </div>
  );
}
