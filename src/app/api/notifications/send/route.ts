import { createClient } from '@/lib/supabase/server';
import { getNotificationProvider } from '@/lib/notifications/providers';
import type { SendNotificationRequest } from '@/types';
import { NextResponse } from 'next/server';

/**
 * POST /api/notifications/send
 *
 * Phase 5 CRM - 멀티채널 알림 발송 API
 * - notifications 테이블에 pending 레코드 생성 후 채널별 provider로 발송
 * - 현재 운영 지원: email, in_app
 * - 카카오 알림톡은 provider 확장 구조만 준비되어 있으며 실제 발송은 비활성 상태
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
    }

    const notificationId = notificationRecord?.id ?? null;
    const provider = getNotificationProvider(channel);

    const result = provider
      ? await provider.send({ title, message, templateId, emailData })
      : {
          success: false,
          error: `Unsupported channel: ${channel}`,
          providerResponse: { error: `Unsupported channel: ${channel}` },
        };

    const finalStatus = result.success ? 'sent' : 'failed';

    if (notificationId) {
      await supabase
        .from('notifications')
        .update({
          status: finalStatus,
          provider_response: result.providerResponse,
          sent_at: finalStatus === 'sent' ? new Date().toISOString() : null,
        })
        .eq('id', notificationId);
    }

    if (result.success) {
      return NextResponse.json({ success: true, notificationId });
    }

    return NextResponse.json(
      {
        success: false,
        error: result.error ?? 'Notification sending failed',
        providerResponse: result.providerResponse,
        notificationId,
      },
      { status: 500 }
    );
  } catch (error) {
    console.error('[notifications/send] Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
