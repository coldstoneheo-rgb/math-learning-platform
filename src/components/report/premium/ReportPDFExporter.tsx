'use client';

/**
 * ReportPDFExporter Component
 *
 * html2canvas + jsPDF를 활용한 리포트 PDF 출력 최적화 래퍼
 * - 고해상도 한글 폰트 지원
 * - 애니메이션 최종 상태로 고정 후 캡처
 * - 다중 페이지 자동 분할
 *
 * @see docs/REPORT_ENHANCEMENT_PLAN(by Gemini).md - Task 3
 */

import { memo, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  Loader2,
  FileText,
  Check,
  AlertCircle,
  Printer,
  Share2,
} from 'lucide-react';

interface ReportPDFExporterProps {
  targetRef: React.RefObject<HTMLElement | null>;
  fileName?: string;
  studentName?: string;
  reportType?: string;
  reportDate?: string;
  onExportStart?: () => void;
  onExportComplete?: (success: boolean) => void;
  showShareButton?: boolean;
  compact?: boolean;
}

type ExportStatus = 'idle' | 'preparing' | 'capturing' | 'generating' | 'complete' | 'error';

const STATUS_CONFIG: Record<ExportStatus, {
  icon: typeof Download;
  label: string;
  color: string;
}> = {
  idle: { icon: Download, label: 'PDF 다운로드', color: 'bg-indigo-600 hover:bg-indigo-700' },
  preparing: { icon: Loader2, label: '준비 중...', color: 'bg-indigo-500' },
  capturing: { icon: Loader2, label: '캡처 중...', color: 'bg-indigo-500' },
  generating: { icon: Loader2, label: 'PDF 생성 중...', color: 'bg-indigo-500' },
  complete: { icon: Check, label: '완료!', color: 'bg-emerald-600' },
  error: { icon: AlertCircle, label: '오류 발생', color: 'bg-rose-600' },
};

async function loadDependencies() {
  const [html2canvasModule, jsPDFModule] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  return {
    html2canvas: html2canvasModule.default,
    jsPDF: jsPDFModule.default,
  };
}

function ReportPDFExporter({
  targetRef,
  fileName,
  studentName,
  reportType,
  reportDate,
  onExportStart,
  onExportComplete,
  showShareButton = false,
  compact = false,
}: ReportPDFExporterProps) {
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [progress, setProgress] = useState(0);

  const generateFileName = useCallback(() => {
    if (fileName) return fileName;

    const parts = ['리포트'];
    if (studentName) parts.unshift(studentName);
    if (reportType) parts.push(reportType);
    if (reportDate) parts.push(reportDate.replace(/-/g, ''));

    return `${parts.join('_')}.pdf`;
  }, [fileName, studentName, reportType, reportDate]);

  const handleExport = useCallback(async () => {
    if (!targetRef.current || status !== 'idle') return;

    try {
      onExportStart?.();
      setStatus('preparing');
      setProgress(10);

      const { html2canvas, jsPDF } = await loadDependencies();
      setProgress(20);

      setStatus('capturing');

      const element = targetRef.current;
      const originalStyle = element.style.cssText;

      element.style.cssText += `
        animation: none !important;
        transition: none !important;
      `;

      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.body.querySelector('[data-pdf-target]');
          if (clonedElement) {
            const animations = clonedElement.querySelectorAll('[class*="animate-"]');
            animations.forEach((el) => {
              (el as HTMLElement).style.animation = 'none';
            });
          }
        },
      });

      element.style.cssText = originalStyle;

      setProgress(60);
      setStatus('generating');

      const imgData = canvas.toDataURL('image/png', 1.0);
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 10;

      const contentWidth = pdfWidth - margin * 2;
      const contentHeight = (imgHeight * contentWidth) / imgWidth;

      const pdf = new jsPDF({
        orientation: contentHeight > pdfHeight ? 'portrait' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageHeight = pdfHeight - margin * 2;
      const totalPages = Math.ceil(contentHeight / pageHeight);

      setProgress(80);

      if (totalPages === 1) {
        pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
      } else {
        for (let page = 0; page < totalPages; page++) {
          if (page > 0) {
            pdf.addPage();
          }

          const srcY = (page * pageHeight * imgWidth) / contentWidth;
          const srcHeight = Math.min(
            (pageHeight * imgWidth) / contentWidth,
            imgHeight - srcY
          );

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = imgWidth;
          tempCanvas.height = srcHeight;

          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCtx.drawImage(
              canvas,
              0,
              srcY,
              imgWidth,
              srcHeight,
              0,
              0,
              imgWidth,
              srcHeight
            );

            const pageImgData = tempCanvas.toDataURL('image/png', 1.0);
            const pageContentHeight = (srcHeight * contentWidth) / imgWidth;

            pdf.addImage(pageImgData, 'PNG', margin, margin, contentWidth, pageContentHeight);
          }

          setProgress(80 + (page / totalPages) * 15);
        }
      }

      const pdfFileName = generateFileName();
      pdf.save(pdfFileName);

      setProgress(100);
      setStatus('complete');
      onExportComplete?.(true);

      setTimeout(() => {
        setStatus('idle');
        setProgress(0);
      }, 2000);

    } catch (error) {
      console.error('PDF export error:', error);
      setStatus('error');
      onExportComplete?.(false);

      setTimeout(() => {
        setStatus('idle');
        setProgress(0);
      }, 3000);
    }
  }, [targetRef, status, generateFileName, onExportStart, onExportComplete]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleShare = useCallback(async () => {
    if (!navigator.share) {
      alert('이 브라우저에서는 공유 기능을 지원하지 않습니다.');
      return;
    }

    try {
      await navigator.share({
        title: `${studentName || '학생'} ${reportType || '리포트'}`,
        text: `${studentName || '학생'}의 ${reportType || '학습 리포트'}입니다.`,
        url: window.location.href,
      });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Share error:', error);
      }
    }
  }, [studentName, reportType]);

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const isLoading = ['preparing', 'capturing', 'generating'].includes(status);

  if (compact) {
    return (
      <motion.button
        onClick={handleExport}
        disabled={isLoading}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium text-sm ${config.color} transition-colors disabled:opacity-70`}
        whileHover={{ scale: isLoading ? 1 : 1.02 }}
        whileTap={{ scale: isLoading ? 1 : 0.98 }}
      >
        <Icon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        {config.label}
      </motion.button>
    );
  }

  return (
    <motion.div
      className="bg-white rounded-xl shadow-sm border border-slate-200 p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-slate-600" />
          <span className="font-medium text-slate-700">리포트 내보내기</span>
        </div>
        {studentName && (
          <span className="text-xs text-slate-500">{studentName}</span>
        )}
      </div>

      {/* Progress Bar */}
      {isLoading && (
        <div className="mb-3">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-indigo-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1 text-center">{progress}%</p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2">
        <motion.button
          onClick={handleExport}
          disabled={isLoading}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white font-medium text-sm ${config.color} transition-colors disabled:opacity-70`}
          whileHover={{ scale: isLoading ? 1 : 1.02 }}
          whileTap={{ scale: isLoading ? 1 : 0.98 }}
        >
          <Icon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {config.label}
        </motion.button>

        <motion.button
          onClick={handlePrint}
          disabled={isLoading}
          className="px-3 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          title="인쇄"
        >
          <Printer className="w-4 h-4" />
        </motion.button>

        {showShareButton && (
          <motion.button
            onClick={handleShare}
            disabled={isLoading}
            className="px-3 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            title="공유"
          >
            <Share2 className="w-4 h-4" />
          </motion.button>
        )}
      </div>

      {/* Help Text */}
      <p className="text-xs text-slate-400 mt-3 text-center">
        PDF로 저장하여 언제든 확인하실 수 있습니다
      </p>
    </motion.div>
  );
}

export default memo(ReportPDFExporter);

/**
 * usePDFExport Hook
 * 프로그래매틱하게 PDF 내보내기를 제어할 때 사용
 */
export function usePDFExport() {
  const targetRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const triggerExport = useCallback(() => {
    const button = document.querySelector('[data-pdf-export-button]') as HTMLButtonElement;
    if (button) {
      button.click();
    }
  }, []);

  return {
    targetRef,
    isExporting,
    setIsExporting,
    triggerExport,
  };
}
