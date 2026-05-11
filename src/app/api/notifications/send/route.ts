import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';
import type { SendNotificationRequest } from '@/types';
import { NextResponse } from 'next/server';

// Resend 인스턴스는 API 키가 있을 때만 생성 (빌드 타임 에러 방지)
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

/**
 * POST /api/notifications/send
 *
 * Phase 5 CRM - 멀티채널 알림 발송 API
 * - notifications 테이블에 pending 레코드 생성 후 채널별 발송
 * - 이메일(Resend) 우선 구현 / 카카오 알림톡 향후 확장 구조 마련
 *
 * 필수 환경변수:
 *   RESEND_API_KEY=re_xxxxxxxx    (Resend 발급 - .env.local에 추가 필요)
 *   NEXT_PUBLIC_APP_URL=https://... (이메일 내 리포트 링크용)
 */
export async function POST(request: Request) {
  try {
    const body: SendNotificationRequest = await request.json();
    const {
      recipientUserId,
      title,
      message,
      channel,
      templateId,
      relatedResourceType,
      relatedResourceId,
      emailData,
    } = body;

    if (!recipientUserId || !title || !message || !channel) {
      return NextResponse.json(
        { success: false, error: 'recipientUserId, title, message, channel are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. DB에 notifications 레코드를 'pending' 상태로 먼저 저장
    const { data: notificationRecord, error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: recipientUserId,
        title,
        message,
        channel,
        status: 'pending',
        template_id: templateId ?? null,
        related_resource_type: relatedResourceType ?? null,
        related_resource_id: relatedResourceId ?? null,
        read: false,
      })
      .select('id')
      .single();

    if (insertError || !notificationRecord) {
      console.error('[notifications/send] DB insert error:', insertError);
      // notifications 테이블이 아직 마이그레이션 안된 경우도 계속 진행
    }

    const notificationId = notificationRecord?.id ?? null;
    let providerResponse: Record<string, unknown> | null = null;
    let finalStatus: 'sent' | 'failed' = 'failed';

    // 2. 채널별 발송 분기
    switch (channel) {
      case 'email': {
        const resendClient = getResendClient();
        if (!resendClient) {
          console.warn('[notifications/send] RESEND_API_KEY is not set.');
          if (notificationId) {
            await supabase
              .from('notifications')
              .update({ status: 'failed', provider_response: { error: 'RESEND_API_KEY not configured' } })
              .eq('id', notificationId);
          }
          return NextResponse.json(
            { success: false, error: 'RESEND_API_KEY is not configured. Add it to .env.local.' },
            { status: 500 }
          );
        }

        const { recipientEmail, recipientName, studentName, reportId, reportUrl } = emailData ?? {};
        if (!recipientEmail) {
          return NextResponse.json(
            { success: false, error: 'emailData.recipientEmail is required for email channel' },
            { status: 400 }
          );
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
        const reportLink = reportUrl ?? (reportId ? `${appUrl}/parent/reports/${reportId}` : `${appUrl}/parent`);

        const { data: resendData, error: resendError } = await resendClient.emails.send({
          from: '수학 학습 플랫폼 <noreply@resend.dev>',
          to: [recipientEmail],
          subject: title,
          html: buildEmailHtml({
            recipientName: recipientName ?? '학부모',
            studentName: studentName ?? '자녀',
            title,
            message,
            reportLink,
          }),
        });

        if (resendError) {
          console.error('[notifications/send] Resend error:', resendError);
          providerResponse = { error: resendError.message ?? 'Resend error' };
          finalStatus = 'failed';
        } else {
          providerResponse = { resend_id: resendData?.id ?? null };
          finalStatus = 'sent';
        }
        break;
      }

      case 'kakao': {
        // 카카오 알림톡: 비즈니스 채널 승인 후 구현 예정
        // templateId, provider_response 필드는 DB에 이미 준비됨
        console.log('[notifications/send] Kakao channel is not yet implemented. template_id:', templateId);
        providerResponse = { error: 'Kakao alimtalk not yet implemented', template_id: templateId };
        finalStatus = 'failed';
        break;
      }

      case 'in_app': {
        // in_app 알림은 DB 레코드 생성만으로 완료 (클라이언트 폴링으로 표시)
        providerResponse = { type: 'in_app_only' };
        finalStatus = 'sent';
        break;
      }

      default: {
        providerResponse = { error: `Unsupported channel: ${channel}` };
        finalStatus = 'failed';
      }
    }

    // 3. 발송 결과를 DB에 업데이트
    if (notificationId) {
      await supabase
        .from('notifications')
        .update({
          status: finalStatus,
          provider_response: providerResponse,
          sent_at: finalStatus === 'sent' ? new Date().toISOString() : null,
        })
        .eq('id', notificationId);
    }

    if (finalStatus === 'sent') {
      return NextResponse.json({ success: true, notificationId });
    } else {
      return NextResponse.json(
        { success: false, error: 'Notification sending failed', providerResponse, notificationId },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[notifications/send] Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// -----------------------------------------------
// 이메일 HTML 템플릿 (프리미엄 디자인)
// -----------------------------------------------
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
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin:0; padding:0; background:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
    .wrap { max-width:600px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .hdr { background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%); padding:40px 40px 32px; text-align:center; }
    .badge { display:inline-block; background:rgba(255,255,255,0.2); color:#fff; border-radius:100px; padding:4px 14px; font-size:12px; font-weight:600; margin-bottom:12px; }
    .hdr h1 { margin:0 0 8px; color:#fff; font-size:22px; font-weight:700; }
    .hdr p { margin:0; color:rgba(255,255,255,0.85); font-size:14px; }
    .body { padding:40px; }
    .greeting { font-size:16px; color:#374151; margin:0 0 20px; }
    .msg-box { background:#f5f3ff; border-left:4px solid #8b5cf6; border-radius:8px; padding:20px 24px; margin:0 0 28px; }
    .msg-box p { margin:0; color:#4b5563; line-height:1.75; font-size:15px; }
    .cta { display:block; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff!important; text-decoration:none; text-align:center; padding:16px 32px; border-radius:12px; font-weight:700; font-size:15px; }
    .hint { text-align:center; color:#9ca3af; font-size:13px; margin:16px 0 0; }
    .ftr { padding:24px 40px; background:#f8fafc; border-top:1px solid #e5e7eb; text-align:center; }
    .ftr p { margin:0; font-size:12px; color:#9ca3af; line-height:1.6; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <div class="badge">📊 수학 학습 플랫폼</div>
      <h1>${title}</h1>
      <p>${studentName} 학생의 새 리포트가 도착했습니다</p>
    </div>
    <div class="body">
      <p class="greeting">안녕하세요, <strong>${recipientName}</strong>님.</p>
      <div class="msg-box"><p>${message}</p></div>
      <a href="${reportLink}" class="cta">📝 리포트 바로 보기 →</a>
      <p class="hint">위 버튼을 눌러 선생님이 작성한 상세 분석 리포트를 확인하세요.</p>
    </div>
    <div class="ftr">
      <p>본 이메일은 수학 학습 플랫폼에서 자동 발송된 알림입니다.<br/>문의는 담당 선생님께 직접 연락 부탁드립니다.</p>
    </div>
  </div>
</body>
</html>`;
}
