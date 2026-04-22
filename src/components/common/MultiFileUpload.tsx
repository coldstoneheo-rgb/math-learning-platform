'use client';

import React, { useCallback, useState, useRef } from 'react';
import { Image, FileText, FileSpreadsheet, Loader2, FolderDown, FolderOpen } from 'lucide-react';
import imageCompression from 'browser-image-compression';

export interface UploadedFile {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'csv';
  mimeType: string;
  size: number;
  data: string; // base64 for images/pdf, raw text for csv
  preview?: string; // base64 preview for images
}

interface MultiFileUploadProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  acceptedTypes?: ('image' | 'pdf' | 'csv')[];
  maxFiles?: number;
  maxSizeMB?: number;
  label?: string;
  helpText?: string;
  required?: boolean;
}

const FILE_TYPE_CONFIG = {
  image: {
    accept: 'image/*',
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    Icon: Image,
    label: '이미지',
  },
  pdf: {
    accept: '.pdf',
    mimeTypes: ['application/pdf'],
    Icon: FileText,
    label: 'PDF',
  },
  csv: {
    accept: '.csv',
    mimeTypes: ['text/csv', 'application/vnd.ms-excel'],
    Icon: FileSpreadsheet,
    label: 'CSV',
  },
};

export default function MultiFileUpload({
  files,
  onFilesChange,
  acceptedTypes = ['image', 'pdf', 'csv'],
  maxFiles = 10,
  maxSizeMB = 10,
  label = '파일 업로드',
  helpText,
  required = false,
}: MultiFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptString = acceptedTypes
    .map((type) => FILE_TYPE_CONFIG[type].accept)
    .join(',');

  const getFileType = (file: File): 'image' | 'pdf' | 'csv' | null => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) return 'csv';
    return null;
  };

  const processFile = useCallback(
    async (file: File): Promise<UploadedFile | null> => {
      const fileType = getFileType(file);
      if (!fileType || !acceptedTypes.includes(fileType)) {
        setError(`지원하지 않는 파일 형식입니다: ${file.name}`);
        return null;
      }

      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`파일 크기가 ${maxSizeMB}MB를 초과합니다: ${file.name}`);
        return null;
      }

      // 이미지 압축 처리
      let processedFile = file;
      if (fileType === 'image') {
        try {
          const compressionOptions = {
            maxSizeMB: 1,              // 최대 1MB로 압축
            maxWidthOrHeight: 1920,    // 최대 해상도
            useWebWorker: true,
            fileType: 'image/jpeg' as const,
            initialQuality: 0.8,
          };
          processedFile = await imageCompression(file, compressionOptions);
          console.log(`[이미지 압축] ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(processedFile.size / 1024 / 1024).toFixed(2)}MB`);
        } catch (compressionError) {
          console.warn('이미지 압축 실패, 원본 사용:', compressionError);
        }
      }

      return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onload = (e) => {
          const result = e.target?.result;
          if (!result) {
            resolve(null);
            return;
          }

          const uploadedFile: UploadedFile = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            type: fileType,
            mimeType: processedFile.type,
            size: processedFile.size,
            data: result as string,
          };

          // 이미지인 경우 미리보기 URL 생성
          if (fileType === 'image') {
            uploadedFile.preview = result as string;
          }

          resolve(uploadedFile);
        };

        reader.onerror = () => resolve(null);

        if (fileType === 'csv') {
          reader.readAsText(processedFile);
        } else {
          reader.readAsDataURL(processedFile);
        }
      });
    },
    [acceptedTypes, maxSizeMB]
  );

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      setError(null);

      const remainingSlots = maxFiles - files.length;
      if (remainingSlots <= 0) {
        setError(`최대 ${maxFiles}개의 파일만 업로드할 수 있습니다.`);
        return;
      }

      const filesToProcess = Array.from(fileList).slice(0, remainingSlots);
      const hasImages = filesToProcess.some((f) => f.type.startsWith('image/'));

      if (hasImages) {
        setIsCompressing(true);
      }

      try {
        const processedFiles = await Promise.all(
          filesToProcess.map((file) => processFile(file))
        );

        const validFiles = processedFiles.filter(
          (f): f is UploadedFile => f !== null
        );
        if (validFiles.length > 0) {
          onFilesChange([...files, ...validFiles]);
        }
      } finally {
        setIsCompressing(false);
      }
    },
    [files, maxFiles, onFilesChange, processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
      // Reset input value to allow selecting the same file again
      e.target.value = '';
    },
    [handleFiles]
  );

  const handleRemoveFile = useCallback(
    (fileId: string) => {
      onFilesChange(files.filter((f) => f.id !== fileId));
    },
    [files, onFilesChange]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const acceptedTypeLabels = acceptedTypes
    .map((type) => FILE_TYPE_CONFIG[type].label)
    .join(', ');

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* 드래그 앤 드롭 영역 */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8
          flex flex-col items-center justify-center
          cursor-pointer transition-all duration-200
          ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
          }
          ${files.length >= maxFiles ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptString}
          multiple
          onChange={handleInputChange}
          className="hidden"
          disabled={files.length >= maxFiles}
        />

        <div className="mb-3">
          {isCompressing ? (
            <Loader2 className="w-10 h-10 text-indigo-500 mx-auto animate-spin" />
          ) : isDragging ? (
            <FolderDown className="w-10 h-10 text-indigo-500 mx-auto" />
          ) : (
            <FolderOpen className="w-10 h-10 text-gray-400 mx-auto" />
          )}
        </div>

        <p className="text-gray-600 text-center">
          {isCompressing ? (
            <span className="text-indigo-600 font-medium">
              이미지 압축 중...
            </span>
          ) : isDragging ? (
            <span className="text-indigo-600 font-medium">
              파일을 여기에 놓으세요
            </span>
          ) : (
            <>
              <span className="text-indigo-600 font-medium">클릭</span>하거나{' '}
              <span className="text-indigo-600 font-medium">드래그</span>하여
              파일을 업로드하세요
            </>
          )}
        </p>

        <p className="text-xs text-gray-500 mt-2">
          {acceptedTypeLabels} 지원 • 최대 {maxFiles}개 • 파일당 최대 {maxSizeMB}MB
        </p>
      </div>

      {/* 도움말 텍스트 */}
      {helpText && (
        <p className="text-xs text-gray-500">{helpText}</p>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 업로드된 파일 목록 */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            업로드된 파일 ({files.length}/{maxFiles})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-200"
              >
                {/* 파일 아이콘/미리보기 */}
                {file.type === 'image' && file.preview ? (
                  <img
                    src={file.preview}
                    alt={file.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                ) : (
                  <div className="w-12 h-12 flex items-center justify-center bg-gray-200 rounded">
                    {(() => {
                      const IconComponent = FILE_TYPE_CONFIG[file.type].Icon;
                      return <IconComponent className="w-6 h-6 text-gray-500" />;
                    })()}
                  </div>
                )}

                {/* 파일 정보 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {FILE_TYPE_CONFIG[file.type].label} •{' '}
                    {formatFileSize(file.size)}
                  </p>
                </div>

                {/* 삭제 버튼 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(file.id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="파일 삭제"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
