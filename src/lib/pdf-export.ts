import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PdfExportOptions {
  filename?: string;
  title?: string;
  quality?: number;  // 1-3, default 2
  margin?: number;   // in mm, default 10
  pageFormat?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
}

/**
 * PDF 내보내기 유틸리티
 * - 고해상도 캡처 (scale 옵션)
 * - 한글 지원 (이미지 기반 캡처로 폰트 문제 해결)
 * - 차트 및 그래프 고품질 렌더링
 */
export async function exportToPdf(
  elementId: string,
  options: PdfExportOptions = {}
): Promise<boolean> {
  const {
    filename = 'report.pdf',
    title,
    quality = 2,
    margin = 10,
    pageFormat = 'a4',
    orientation = 'portrait',
  } = options;

  try {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error('PDF 내보내기: 요소를 찾을 수 없습니다:', elementId);
      return false;
    }

    // html2canvas 옵션 설정
    const canvasOptions = {
      scale: quality,  // 고해상도를 위한 스케일
      useCORS: true,   // 외부 이미지 CORS 허용
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      // 차트/SVG 요소 더 정확하게 렌더링
      onclone: (clonedDoc: Document) => {
        // 프린트 전용 스타일 적용
        const clonedElement = clonedDoc.getElementById(elementId);
        if (clonedElement) {
          clonedElement.style.width = '210mm';  // A4 너비
          clonedElement.style.maxWidth = '210mm';
          // 프린트 시 숨기는 요소 제거
          const printHidden = clonedElement.querySelectorAll('.print\\:hidden');
          printHidden.forEach((el) => el.remove());
        }
      },
    };

    // 캔버스 생성
    const canvas = await html2canvas(element, canvasOptions);

    // PDF 생성
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: pageFormat,
    });

    // 페이지 크기 계산
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - (margin * 2);
    const contentHeight = pageHeight - (margin * 2);

    // 이미지 크기 계산
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // 제목 추가 (선택적)
    if (title) {
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      // 한글 제목은 이미지에 포함되므로 영문 제목만 추가
      pdf.text(title, pageWidth / 2, margin, { align: 'center' });
    }

    const titleOffset = title ? 10 : 0;
    const startY = margin + titleOffset;
    const effectiveContentHeight = contentHeight - titleOffset;

    // 페이지 분할 처리
    if (imgHeight <= effectiveContentHeight) {
      // 단일 페이지
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', margin, startY, imgWidth, imgHeight);
    } else {
      // 여러 페이지로 분할
      let yPosition = 0;
      let pageCount = 0;
      const totalPages = Math.ceil(imgHeight / effectiveContentHeight);

      while (yPosition < imgHeight) {
        if (pageCount > 0) {
          pdf.addPage();
        }

        // 현재 페이지에 들어갈 영역 계산
        const sourceY = (yPosition / imgHeight) * canvas.height;
        const sourceHeight = Math.min(
          (effectiveContentHeight / imgHeight) * canvas.height,
          canvas.height - sourceY
        );

        // 부분 캔버스 생성
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sourceHeight;
        const ctx = pageCanvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(
            canvas,
            0, sourceY, canvas.width, sourceHeight,
            0, 0, canvas.width, sourceHeight
          );

          const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
          const drawHeight = Math.min(effectiveContentHeight, imgHeight - yPosition);

          pdf.addImage(
            pageImgData,
            'JPEG',
            margin,
            pageCount === 0 ? startY : margin,
            imgWidth,
            drawHeight
          );
        }

        yPosition += effectiveContentHeight;
        pageCount++;

        // 페이지 번호 추가
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(
          `${pageCount} / ${totalPages}`,
          pageWidth / 2,
          pageHeight - 5,
          { align: 'center' }
        );
      }
    }

    // 생성 일시 추가 (마지막 페이지 하단)
    const now = new Date();
    const dateStr = now.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    pdf.text(`Generated: ${dateStr}`, margin, pageHeight - 5);

    // PDF 저장
    pdf.save(filename);
    return true;
  } catch (error) {
    console.error('PDF 내보내기 오류:', error);
    return false;
  }
}

/**
 * 특정 차트 요소를 고해상도 이미지로 캡처
 */
export async function captureChartAsImage(
  elementId: string,
  scale: number = 3
): Promise<string | null> {
  try {
    const element = document.getElementById(elementId);
    if (!element) return null;

    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    return canvas.toDataURL('image/png', 1.0);
  } catch (error) {
    console.error('차트 캡처 오류:', error);
    return null;
  }
}

/**
 * 리포트 PDF 내보내기 (미리 설정된 옵션)
 */
export async function exportReportToPdf(
  elementId: string,
  studentName: string,
  testName: string,
  testDate: string
): Promise<boolean> {
  const sanitizedName = studentName.replace(/[^a-zA-Z0-9가-힣\s]/g, '');
  const sanitizedTest = testName.replace(/[^a-zA-Z0-9가-힣\s]/g, '');
  const formattedDate = testDate.replace(/-/g, '');

  return exportToPdf(elementId, {
    filename: `${sanitizedName}_${sanitizedTest}_${formattedDate}.pdf`,
    quality: 2,  // 고해상도
    margin: 10,
    pageFormat: 'a4',
    orientation: 'portrait',
  });
}
