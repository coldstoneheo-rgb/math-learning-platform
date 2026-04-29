/**
 * PII (개인식별정보) 필드 수준 암호화
 *
 * AES-256-GCM을 사용하여 학생 이름, 학교 정보를 암호화합니다.
 * 환경변수 STUDENT_DATA_ENCRYPTION_KEY 설정 필요 (32바이트 hex 문자열)
 *
 * 키 생성 방법:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * GDPR 대응:
 * - 데이터 암호화로 DB 유출 시 개인정보 보호
 * - 키 파기로 암호화된 데이터 일괄 '삭제' 가능 (Crypto Shredding)
 * - Right to Erasure: 개별 학생 키 파기로 해당 학생 데이터 비식별화
 *
 * 환경변수 미설정 시 평문 fallback (개발 환경)
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const ENCODING = 'base64url' as BufferEncoding;

function getEncryptionKey(): Buffer | null {
  const keyHex = process.env.STUDENT_DATA_ENCRYPTION_KEY;
  if (!keyHex) return null;

  // 32바이트(256비트) hex 키 검증
  if (keyHex.length !== 64) {
    console.warn('[PII] 암호화 키 길이가 올바르지 않습니다 (64자 hex 필요). 평문 fallback.');
    return null;
  }

  return Buffer.from(keyHex, 'hex');
}

interface EncryptedField {
  /** iv:tag:ciphertext (base64url 인코딩, ':' 구분자) */
  value: string;
  encrypted: true;
}

interface PlainField {
  value: string;
  encrypted: false;
}

type PIIField = EncryptedField | PlainField;

/**
 * 문자열 암호화
 * 환경변수 미설정 시 평문 반환
 */
export function encryptField(plaintext: string): string {
  if (!plaintext) return plaintext;

  const key = getEncryptionKey();
  if (!key) return plaintext; // 키 없으면 평문

  try {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    // iv:tag:ciphertext 형식으로 저장
    const result = `${iv.toString(ENCODING)}:${tag.toString(ENCODING)}:${encrypted.toString(ENCODING)}`;
    return `enc:${result}`; // 암호화 마커 접두사
  } catch (error) {
    console.error('[PII] 암호화 실패:', error);
    return plaintext; // 실패 시 평문 fallback
  }
}

/**
 * 문자열 복호화
 * 암호화되지 않은 값(레거시)도 처리
 */
export function decryptField(value: string): string {
  if (!value) return value;
  if (!value.startsWith('enc:')) return value; // 평문 (레거시 또는 키 없는 환경)

  const key = getEncryptionKey();
  if (!key) {
    console.warn('[PII] 복호화 키 없음. 암호화된 값을 반환합니다.');
    return value;
  }

  try {
    const encoded = value.slice(4); // 'enc:' 제거
    const parts = encoded.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted format');

    const iv = Buffer.from(parts[0], ENCODING);
    const tag = Buffer.from(parts[1], ENCODING);
    const ciphertext = Buffer.from(parts[2], ENCODING);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('[PII] 복호화 실패:', error);
    return '[복호화 오류]';
  }
}

/**
 * 이름 마스킹 (표시용)
 * 예: '김철수' → '김**'
 */
export function maskName(name: string): string {
  if (!name || name.length === 0) return name;
  const decrypted = decryptField(name);
  if (decrypted.length <= 1) return decrypted;
  return decrypted[0] + '*'.repeat(decrypted.length - 1);
}

/**
 * 학생 생성/수정 시 PII 필드 암호화
 */
export function encryptStudentPII(student: {
  name?: string;
  school?: string;
  [key: string]: unknown;
}): typeof student {
  const result = { ...student };
  if (result.name) result.name = encryptField(result.name);
  if (result.school) result.school = encryptField(result.school);
  return result;
}

/**
 * DB에서 가져온 학생 데이터의 PII 필드 복호화
 */
export function decryptStudentPII(student: {
  name?: string;
  school?: string;
  [key: string]: unknown;
}): typeof student {
  const result = { ...student };
  if (result.name) result.name = decryptField(result.name as string);
  if (result.school) result.school = decryptField(result.school as string);
  return result;
}

/**
 * 학생 배열 일괄 복호화
 */
export function decryptStudentList<T extends { name?: string; school?: string }>(
  students: T[]
): T[] {
  return students.map((s) => decryptStudentPII(s) as T);
}

/**
 * 데이터 해시 (검색용 - 복호화 없이 일치 여부 확인)
 * 검색 인덱스용 단방향 해시 (SHA-256 + 앱 시크릿)
 */
export function hashForSearch(value: string): string {
  const secret = process.env.STUDENT_DATA_ENCRYPTION_KEY || 'default-search-secret';
  return createHash('sha256')
    .update(`${secret}:${value.toLowerCase().trim()}`)
    .digest('hex');
}
