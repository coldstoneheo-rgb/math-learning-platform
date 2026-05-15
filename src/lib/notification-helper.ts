/**
 * 학부모 알림 발송 헬퍼
 *
 * 리포트 생성 후 학부모에게 자동 알림을 발송합니다.
 * Feature Flag로 on/off 가능하며, 에러 시 조용히 실패합니다.
 */

import { isFeatureEnabledForUser, FEATURE_FLAGS } from './feature-flags';

interface SendReportNotificationParams {
  reportId: number;
  studentId: number;
  userId?: string;
  userRole?: 'teacher' | 'parent' | 'student';
}

interface NotificationResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
}

/**
 * 리포트 생성 알림 발송
 *
 * 리포트 저장 직후 호출하여 학부모에게 이메일 알림을 발송합니다.
 * Feature flag가 비활성화되어 있거나, 학부모가 없으면 조용히 스킵합니다.
 *
 * @example
 * const result = await sendReportCreatedNotification({
 *   reportId: insertedReport.id,
 *   studentId: selectedStudentId,
 * });
 */
export async function sendReportCreatedNotification(
  params: SendReportNotificationParams
): Promise<NotificationResult> {
  const { reportId, studentId, userId, userRole } = params;

  // Feature flag 확인
  const notificationsEnabled = isFeatureEnabledForUser(
    FEATURE_FLAGS.PARENT_NOTIFICATIONS,
    userId,
    userRole ?? 'teacher'
  );

  if (!notificationsEnabled) {
    return {
      success: true,
      skipped: true,
      reason: 'Feature flag disabled',
    };
  }

  try {
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'report',
        data: {
          reportId,
          studentId,
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.warn('[Notification] 알림 발송 실패:', result.error);
      return {
        success: false,
        reason: result.error,
      };
    }

    if (result.skipped) {
      return {
        success: true,
        skipped: true,
        reason: result.message,
      };
    }

    console.log('[Notification] 학부모 알림 발송 완료:', result.messageId);
    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    console.warn('[Notification] 알림 API 호출 실패:', error);
    return {
      success: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 학습 계획 알림 발송
 */
export async function sendStudyPlanCreatedNotification(
  planId: number,
  studentId: number
): Promise<NotificationResult> {
  try {
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'study_plan',
        data: { planId, studentId },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, reason: result.error };
    }

    return { success: true, messageId: result.messageId };
  } catch (error) {
    return {
      success: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
