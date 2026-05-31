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

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      if (width > 0 && height > 0) {
        setIsReady(true);
        observer.disconnect();
      }
    });
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
