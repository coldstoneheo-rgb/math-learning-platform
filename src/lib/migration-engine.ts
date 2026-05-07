/**
 * Phase 3: Legacy Data Migration Engine
 * 클라이언트 단에서 파일(이미지/PDF)을 처리하고 API로 순차 전송하기 위한 유틸리티 모듈입니다.
 */

import * as pdfjsLib from 'pdfjs-dist';

// pdf.js 워커 설정 (Next.js public 폴더 혹은 CDN 활용)
// Vercel 배포 환경을 고려해 안정적인 CDN 워커를 사용합니다.
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * File 객체를 Base64 Data URL로 변환합니다.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

/**
 * PDF 파일을 읽어 각 페이지를 Base64 이미지 배열로 변환합니다.
 * 한글 깨짐 방지를 위해 cMapUrl 및 cMapPacked 옵션을 활성화합니다.
 */
export async function convertPdfToImages(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  
  // cMap 설정을 통해 한글 폰트 지원
  const CMAP_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`;
  const CMAP_PACKED = true;

  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    cMapUrl: CMAP_URL,
    cMapPacked: CMAP_PACKED,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const images: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    // 해상도를 높이기 위해 scale을 2.0으로 설정 (모바일 스캔본 등 화질 보정)
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Canvas 2d context 생성을 실패했습니다.');
    }

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
    
    // JPEG 포맷, 품질 0.8로 압축하여 Base64 생성
    const base64Image = canvas.toDataURL('image/jpeg', 0.8);
    // 'data:image/jpeg;base64,' 접두사 유지 여부는 API 쪽 처리에 맞춤 (보통 유지하거나 분리)
    images.push(base64Image);
  }

  return images;
}

export interface MigrationTask {
  id: string;
  file: File;
  documentDate: string;
  documentType: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  progress: number;
  extractedSignals?: {
    id: string;
    date: string;
    sourceType: string;
    affectedPillars: string[];
    insight: string;
    relatedConcepts: string[];
    confidenceScore: number;
  }[];
  errorMsg?: string;
}

export type MigrationTaskMap = Record<string, MigrationTask>;

/**
 * 클라이언트에서 파일을 전처리(PDF 분할 등)하여 서버의 Ingestion API로 전송합니다.
 * 이 함수는 1개의 파일 단위로 호출되며, 내부적으로 여러 장의 이미지가 반환될 수 있습니다.
 */
export async function processMigrationTask(
  task: MigrationTask,
  studentId: number,
  studentName: string
): Promise<MigrationTask> {
  try {
    let base64Images: string[] = [];

    if (task.file.type === 'application/pdf') {
      base64Images = await convertPdfToImages(task.file);
    } else if (task.file.type.startsWith('image/')) {
      const base64 = await fileToBase64(task.file);
      base64Images.push(base64);
    } else {
      throw new Error('지원하지 않는 파일 형식입니다. (이미지 또는 PDF만 가능)');
    }

    // 서버로 전송할 때는 접두사(data:image/jpeg;base64,)를 제거하고 순수 base64 데이터만 전송
    const cleanBase64Images = base64Images.map(img => 
      img.replace(/^data:image\/(jpeg|png|jpg);base64,/, '')
    );

    const payload = {
      studentId,
      studentName,
      images: cleanBase64Images,
      documentDate: task.documentDate,
      documentType: task.documentType,
    };

    const response = await fetch('/api/migration/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // 대용량 페이로드가 될 수 있으므로 서버의 limit 제한 확인 필요
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'API 요청 실패');
    }

    const data = await response.json();
    
    return {
      ...task,
      status: 'success',
      progress: 100,
      extractedSignals: data.extractedSignals,
    };
  } catch (error) {
    console.error('Task 처리 중 오류:', error);
    return {
      ...task,
      status: 'error',
      progress: 0,
      errorMsg: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}
