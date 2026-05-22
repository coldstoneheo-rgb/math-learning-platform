/**
 * Phase 3: Legacy Data Migration Engine
 * 클라이언트 단에서 파일(이미지/PDF)을 처리하고 API로 순차 전송하기 위한 유틸리티 모듈입니다.
 */

import imageCompression from 'browser-image-compression';

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
 * Base64 이미지를 browser-image-compression으로 압축하여 Vercel Payload 크기를 줄입니다.
 */
async function compressBase64Image(base64: string): Promise<string> {
  const res = await fetch(base64);
  const blob = await res.blob();
  
  const options = {
    maxSizeMB: 0.4, // 최대 400KB
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  };
  
  const compressedBlob = await imageCompression(blob as File, options);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(compressedBlob);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

/**
 * PDF 파일을 읽어 각 페이지를 Base64 이미지 배열로 변환합니다.
 * 한글 깨짐 방지를 위해 cMapUrl 및 cMapPacked 옵션을 활성화합니다.
 */
export async function convertPdfToImages(file: File): Promise<string[]> {
  // 동적 import로 브라우저에서만 로드되도록 함
  const pdfjsLib = await import('pdfjs-dist');

  // pdf.js 워커 설정 (CDN 활용). 명시적 HTTPS로 혼합 콘텐츠/로컬 scheme 문제를 피합니다.
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();

  // cMap 설정을 통해 한글 폰트 지원
  const CMAP_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`;
  const CMAP_PACKED = true;

  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    cMapUrl: CMAP_URL,
    cMapPacked: CMAP_PACKED,
  });

  const pdf = await loadingTask.promise.catch((error: unknown) => {
    throw new Error(
      `PDF 변환에 실패했습니다. 네트워크에서 pdf.js worker/cMap 리소스를 불러올 수 있는지 확인해주세요. ${error instanceof Error ? error.message : ''}`.trim()
    );
  });
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
      canvas: canvas,
    };

    await page.render(renderContext).promise;

    // JPEG 포맷, 품질 0.8로 압축하여 Base64 생성
    const base64Image = canvas.toDataURL('image/jpeg', 0.8);
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
      const rawImages = await convertPdfToImages(task.file);
      // PDF에서 추출된 고화질 이미지를 하나씩 압축
      base64Images = await Promise.all(rawImages.map(img => compressBase64Image(img)));
    } else if (task.file.type.startsWith('image/')) {
      // 일반 이미지 파일 자체를 먼저 압축
      const options = { maxSizeMB: 0.4, maxWidthOrHeight: 1920, useWebWorker: true };
      const compressedFile = await imageCompression(task.file, options);
      const base64 = await fileToBase64(compressedFile);
      base64Images.push(base64);
    } else {
      throw new Error('지원하지 않는 파일 형식입니다. (이미지 또는 PDF만 가능)');
    }

    // 서버로 전송할 때는 접두사(data:image/jpeg;base64,)를 제거하고 순수 base64 데이터만 전송
    const cleanBase64Images = base64Images.map(img =>
      img.replace(/^data:image\/(jpeg|png|jpg);base64,/, '')
    );

    // Vercel Serverless Payload 제한(4.5MB) 회피를 위해 청크 분할 전송 (한 번에 최대 3장)
    const CHUNK_SIZE = 3;
    let allExtractedSignals: NonNullable<MigrationTask['extractedSignals']> = [];

    for (let i = 0; i < cleanBase64Images.length; i += CHUNK_SIZE) {
      const chunkedImages = cleanBase64Images.slice(i, i + CHUNK_SIZE);

      const payload = {
        studentId,
        studentName,
        images: chunkedImages,
        documentDate: task.documentDate,
        documentType: task.documentType,
      };

      const response = await fetch('/api/migration/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || `API 요청 실패 (청크 ${i / CHUNK_SIZE + 1})`);
        } else {
          // 504 Gateway Timeout 등 HTML 에러 응답 처리
          if (response.status === 504) {
            throw new Error('서버 응답 시간이 초과되었습니다 (504). 데이터가 너무 크거나 서버 부하가 높습니다.');
          }
          throw new Error(`API 응답 오류 (${response.status})`);
        }
      }

      const data = await response.json();
      if (data.extractedSignals) {
        allExtractedSignals = [...allExtractedSignals, ...data.extractedSignals];
      }
    }

    return {
      ...task,
      status: 'success',
      progress: 100,
      extractedSignals: allExtractedSignals,
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
