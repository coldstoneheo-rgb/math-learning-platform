/**
 * 이메일 알림 서비스 (Resend)
 *
 * 학부모에게 리포트 생성 알림 등을 발송합니다.
 */

import { Resend } from 'resend';
import type { ReportType } from '@/types';

// Resend 클라이언트 (지연 초기화)
let _resend: Resend | null = null;

function getResendClient(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

// 발신자 이메일 (Resend에서 인증된 도메인 필요)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@mathlearning.app';
const FROM_NAME = process.env.RESEND_FROM_NAME || '수학 학습 플랫폼';

/**
 * 리포트 타입별 한글 이름
 */
const REPORT_TYPE_NAMES: Record<ReportType, string> = {
  level_test: '레벨 테스트',
  test: '시험 분석',
  weekly: '주간 리포트',
  monthly: '월간 리포트',
  semi_annual: '반기 리포트',
  annual: '연간 리포트',
  consolidated: '종합 리포트',
};

/**
 * 리포트 생성 알림 이메일 데이터
 */
interface ReportNotificationData {
  parentEmail: string;
  parentName: string;
  studentName: string;
  reportType: ReportType;
  reportId: number;
  reportTitle?: string;
  reportDate?: string;
  summary?: string;
}

/**
 * 리포트 생성 알림 이메일 발송
 */
export async function sendReportNotification(data: ReportNotificationData): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const {
    parentEmail,
    parentName,
    studentName,
    reportType,
    reportId,
    reportTitle,
    reportDate,
    summary,
  } = data;

  const reportTypeName = REPORT_TYPE_NAMES[reportType];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const reportUrl = `${baseUrl}/parent/reports/${reportId}`;

  const subject = `[${studentName}] ${reportTypeName}가 생성되었습니다`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                수학 학습 리포트
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px;">
                안녕하세요, <strong>${parentName}</strong>님
              </p>

              <p style="margin: 0 0 24px; color: #374151; font-size: 16px;">
                <strong>${studentName}</strong> 학생의 새로운 <strong style="color: #4f46e5;">${reportTypeName}</strong>가 생성되었습니다.
              </p>

              <!-- Report Info Box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      ${reportTitle ? `
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 80px;">제목</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${reportTitle}</td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 80px;">유형</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${reportTypeName}</td>
                      </tr>
                      ${reportDate ? `
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 80px;">날짜</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${reportDate}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              ${summary ? `
              <div style="margin-bottom: 24px; padding: 16px; background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 4px;">
                <p style="margin: 0; color: #166534; font-size: 14px;">
                  <strong>요약:</strong> ${summary}
                </p>
              </div>
              ` : ''}

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center; padding: 8px 0 24px;">
                    <a href="${reportUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      리포트 확인하기
                    </a>
                  </td>
                </tr>
              </table>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                본 이메일은 발신 전용입니다. 문의사항이 있으시면 담당 선생님께 연락해 주세요.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                &copy; ${new Date().getFullYear()} 수학 학습 플랫폼. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    const { data: result, error } = await getResendClient().emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [parentEmail],
      subject,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send report notification:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] Report notification sent:', result?.id);
    return { success: true, messageId: result?.id };
  } catch (error) {
    console.error('[Email] Error sending report notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 학습 계획 알림 이메일 데이터
 */
interface StudyPlanNotificationData {
  parentEmail: string;
  parentName: string;
  studentName: string;
  planTitle: string;
  planId: number;
  startDate: string;
  endDate: string;
  taskCount: number;
}

/**
 * 학습 계획 생성 알림 이메일 발송
 */
export async function sendStudyPlanNotification(data: StudyPlanNotificationData): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const {
    parentEmail,
    parentName,
    studentName,
    planTitle,
    planId,
    startDate,
    endDate,
    taskCount,
  } = data;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const planUrl = `${baseUrl}/parent/study-plans/${planId}`;

  const subject = `[${studentName}] 새로운 학습 계획이 등록되었습니다`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                학습 계획 알림
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px;">
                안녕하세요, <strong>${parentName}</strong>님
              </p>

              <p style="margin: 0 0 24px; color: #374151; font-size: 16px;">
                <strong>${studentName}</strong> 학생의 새로운 학습 계획이 등록되었습니다.
              </p>

              <!-- Plan Info Box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 16px; color: #111827; font-size: 18px;">${planTitle}</h3>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 80px;">기간</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${startDate} ~ ${endDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 80px;">학습 항목</td>
                        <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${taskCount}개</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
                학습 계획을 확인하고 자녀의 학습 진도를 함께 체크해 주세요.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center; padding: 8px 0 24px;">
                    <a href="${planUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      학습 계획 확인하기
                    </a>
                  </td>
                </tr>
              </table>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                본 이메일은 발신 전용입니다. 문의사항이 있으시면 담당 선생님께 연락해 주세요.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                &copy; ${new Date().getFullYear()} 수학 학습 플랫폼. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    const { data: result, error } = await getResendClient().emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [parentEmail],
      subject,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send study plan notification:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] Study plan notification sent:', result?.id);
    return { success: true, messageId: result?.id };
  } catch (error) {
    console.error('[Email] Error sending study plan notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 주간 진도 리마인더 이메일 데이터
 */
interface WeeklyReminderData {
  parentEmail: string;
  parentName: string;
  studentName: string;
  completedTasks: number;
  totalTasks: number;
  progressPercentage: number;
  upcomingTasks: string[];
}

/**
 * 주간 진도 리마인더 이메일 발송
 */
export async function sendWeeklyReminder(data: WeeklyReminderData): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const {
    parentEmail,
    parentName,
    studentName,
    completedTasks,
    totalTasks,
    progressPercentage,
    upcomingTasks,
  } = data;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const dashboardUrl = `${baseUrl}/parent`;

  const subject = `[${studentName}] 이번 주 학습 진행 현황`;

  const progressColor = progressPercentage >= 80 ? '#22c55e' : progressPercentage >= 50 ? '#eab308' : '#ef4444';

  const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                주간 학습 현황
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px;">
                안녕하세요, <strong>${parentName}</strong>님
              </p>

              <p style="margin: 0 0 24px; color: #374151; font-size: 16px;">
                <strong>${studentName}</strong> 학생의 이번 주 학습 진행 현황을 안내해 드립니다.
              </p>

              <!-- Progress Box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <div style="font-size: 48px; font-weight: bold; color: ${progressColor}; margin-bottom: 8px;">
                      ${progressPercentage}%
                    </div>
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">
                      ${completedTasks}/${totalTasks} 항목 완료
                    </p>

                    <!-- Progress Bar -->
                    <div style="margin-top: 16px; background-color: #e5e7eb; border-radius: 9999px; height: 8px; overflow: hidden;">
                      <div style="width: ${progressPercentage}%; height: 100%; background-color: ${progressColor}; border-radius: 9999px;"></div>
                    </div>
                  </td>
                </tr>
              </table>

              ${upcomingTasks.length > 0 ? `
              <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px; color: #111827; font-size: 16px;">남은 학습 항목</h3>
                <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 14px;">
                  ${upcomingTasks.slice(0, 5).map(task => `<li style="margin-bottom: 8px;">${task}</li>`).join('')}
                  ${upcomingTasks.length > 5 ? `<li style="color: #6b7280;">외 ${upcomingTasks.length - 5}개...</li>` : ''}
                </ul>
              </div>
              ` : ''}

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center; padding: 8px 0 24px;">
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      대시보드 확인하기
                    </a>
                  </td>
                </tr>
              </table>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                본 이메일은 발신 전용입니다. 문의사항이 있으시면 담당 선생님께 연락해 주세요.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                &copy; ${new Date().getFullYear()} 수학 학습 플랫폼. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    const { data: result, error } = await getResendClient().emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [parentEmail],
      subject,
      html: htmlContent,
    });

    if (error) {
      console.error('[Email] Failed to send weekly reminder:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] Weekly reminder sent:', result?.id);
    return { success: true, messageId: result?.id };
  } catch (error) {
    console.error('[Email] Error sending weekly reminder:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 이메일 발송 가능 여부 확인
 */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
