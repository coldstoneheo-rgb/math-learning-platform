import type { NotificationChannel, SendNotificationResponse } from '@/types';

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: '이메일',
  in_app: '인앱',
  kakao: '카카오 알림톡',
  push: '푸시',
};

export interface NotificationChannelResult {
  channel: NotificationChannel;
  ok: boolean;
  status?: SendNotificationResponse['status'];
  error?: string;
}

export interface NotificationSummary {
  successfulLabels: string[];
  failedLabels: string[];
  failureDetails: string[];
  successCount: number;
  failedCount: number;
  totalCount: number;
  tone: 'success' | 'partial' | 'failed';
  message: string;
}

export function getNotificationChannelLabel(channel: NotificationChannel | string) {
  return NOTIFICATION_CHANNEL_LABELS[channel as NotificationChannel] ?? channel;
}

export function summarizeNotificationSendResults(
  results: NotificationChannelResult[],
  recipientName = '학부모',
  skippedReasons: string[] = []
): NotificationSummary {
  const successful = results.filter(result => result.ok);
  const failed = results.filter(result => !result.ok);

  const successfulLabels = successful.map(result => getNotificationChannelLabel(result.channel));
  const failedLabels = failed.map(result => getNotificationChannelLabel(result.channel));
  const failureDetails = failed.map((result) => {
    const label = getNotificationChannelLabel(result.channel);
    return result.error ? `${label}: ${result.error}` : `${label}: 발송 실패`;
  });

  const totalCount = results.length;
  const successCount = successful.length;
  const failedCount = failed.length;
  const skippedText = skippedReasons.length > 0 ? ` ${skippedReasons.join(' ')}` : '';

  if (failedCount === 0) {
    const labelText = successfulLabels.length > 0 ? successfulLabels.join('/') : '알림';
    return {
      successfulLabels,
      failedLabels,
      failureDetails,
      successCount,
      failedCount,
      totalCount,
      tone: 'success',
      message: `${recipientName}님께 ${labelText} 알림을 발송했습니다.${skippedText}`,
    };
  }

  if (successCount > 0) {
    return {
      successfulLabels,
      failedLabels,
      failureDetails,
      successCount,
      failedCount,
      totalCount,
      tone: 'partial',
      message: `알림 ${successCount}건 성공, ${failedCount}건 실패했습니다. ${failureDetails.join(' / ')}${skippedText}`,
    };
  }

  return {
    successfulLabels,
    failedLabels,
    failureDetails,
    successCount,
    failedCount,
    totalCount,
    tone: 'failed',
    message: `알림 발송에 실패했습니다. ${failureDetails.join(' / ')}${skippedText}`,
  };
}
