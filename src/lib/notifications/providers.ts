import { Resend } from 'resend';

export interface NotificationPayload {
  title: string;
  message: string;
  templateId?: string;
  emailData?: {
    recipientEmail?: string;
    recipientName?: string;
    studentName?: string;
    reportId?: number;
    reportUrl?: string;
  };
}

export interface NotificationProviderResult {
  success: boolean;
  providerResponse: Record<string, unknown>;
  error?: string;
}

export interface NotificationProvider {
  send(payload: NotificationPayload): Promise<NotificationProviderResult>;
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export class EmailNotificationProvider implements NotificationProvider {
  async send(payload: NotificationPayload): Promise<NotificationProviderResult> {
    const resendClient = getResendClient();
    if (!resendClient) {
      return {
        success: false,
        error: 'RESEND_API_KEY is not configured. Add it to .env.local.',
        providerResponse: { error: 'RESEND_API_KEY not configured' },
      };
    }

    const { recipientEmail, recipientName, studentName, reportId, reportUrl } = payload.emailData ?? {};
    if (!recipientEmail) {
      return {
        success: false,
        error: 'emailData.recipientEmail is required for email channel',
        providerResponse: { error: 'recipientEmail missing' },
      };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const reportLink = reportUrl ?? (reportId ? `${appUrl}/parent/reports/${reportId}` : `${appUrl}/parent`);

    const { data, error } = await resendClient.emails.send({
      from: '수학 학습 플랫폼 <noreply@resend.dev>',
      to: [recipientEmail],
      subject: payload.title,
      html: buildEmailHtml({
        recipientName: recipientName ?? '학부모',
        studentName: studentName ?? '자녀',
        title: payload.title,
        message: payload.message,
        reportLink,
      }),
    });

    if (error) {
      return {
        success: false,
        error: error.message ?? 'Resend error',
        providerResponse: { error: error.message ?? 'Resend error' },
      };
    }

    return {
      success: true,
      providerResponse: { resend_id: data?.id ?? null },
    };
  }
}

export class InAppNotificationProvider implements NotificationProvider {
  async send(): Promise<NotificationProviderResult> {
    return {
      success: true,
      providerResponse: { type: 'in_app_only' },
    };
  }
}

export class KakaoAlimtalkProvider implements NotificationProvider {
  async send(payload: NotificationPayload): Promise<NotificationProviderResult> {
    return {
      success: false,
      error: '카카오 알림톡은 아직 실제 발송이 연결되지 않았습니다. 비즈니스 채널, 승인 템플릿, 학부모 전화번호, 수신 동의, 발송 결과 웹훅을 먼저 준비해야 합니다.',
      providerResponse: {
        error: 'Kakao alimtalk not yet implemented',
        template_id: payload.templateId ?? null,
        status: 'not_implemented',
        required: ['business_channel', 'approved_template', 'parent_phone', 'recipient_consent', 'delivery_webhook'],
      },
    };
  }
}

export function getNotificationProvider(channel: string): NotificationProvider | null {
  switch (channel) {
    case 'email':
      return new EmailNotificationProvider();
    case 'in_app':
      return new InAppNotificationProvider();
    case 'kakao':
      return new KakaoAlimtalkProvider();
    default:
      return null;
  }
}

function buildEmailHtml({
  recipientName,
  studentName,
  title,
  message,
  reportLink,
}: {
  recipientName: string;
  studentName: string;
  title: string;
  message: string;
  reportLink: string;
}) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 20px;border-bottom:1px solid #eef2ff;background:#f5f7ff;">
              <div style="font-size:13px;color:#4f46e5;font-weight:700;margin-bottom:8px;">수학 학습 성장 리포트</div>
              <h1 style="margin:0;font-size:22px;line-height:1.35;color:#111827;">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">
                ${escapeHtml(recipientName)}님, ${escapeHtml(studentName)} 학생의 학습 분석 소식입니다.
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#374151;">
                ${escapeHtml(message)}
              </p>
              <a href="${escapeHtml(reportLink)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;">
                리포트 확인하기
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.6;">
              이 알림은 수학 학습 컨설팅 플랫폼에서 발송되었습니다.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
