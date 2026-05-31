import { createClient } from '@/lib/supabase/server';
import { getNotificationProvider } from '@/lib/notifications/providers';
import type { NotificationChannel, SendNotificationRequest, SendNotificationResponse } from '@/types';
import { NextResponse } from 'next/server';

/**
 * POST /api/notifications/send
 *
 * Phase 5 CRM - 멀티채널 알림 발송 API
 * - notifications 테이블에 pending 레코드 생성 후 채널별 provider로 발송
 * - 현재 운영 지원: email, in_app
 * - 카카오 알림톡은 provider 확장 구조만 준비되어 있으며 실제 발송은 비활성 상태
 */
const KNOWN_CHANNELS: NotificationChannel[] = ['email', 'in_app', 'kakao', 'push'];

function jsonResponse(body: SendNotificationResponse, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ success: false, error: 'Unauthorized', status: 'failed' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role !== 'teacher') {
      return jsonResponse({ success: false, error: 'Forbidden', status: 'failed' }, { status: 403 });
    }

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
      return jsonResponse(
        { success: false, channel, status: 'failed', error: 'recipientUserId, title, message, channel are required' },
        { status: 400 }
      );
    }

    if (!KNOWN_CHANNELS.includes(channel)) {
      return jsonResponse(
        { success: false, channel, status: 'failed', error: `Unsupported channel: ${channel}` },
        { status: 400 }
      );
    }

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
      return jsonResponse(
        { success: false, channel, status: 'failed', error: 'Failed to create notification record' },
        { status: 500 }
      );
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
      return jsonResponse({ success: true, notificationId, channel, status: 'sent' });
    }

    return jsonResponse(
      {
        success: false,
        channel,
        status: 'failed',
        error: result.error ?? 'Notification sending failed',
        providerResponse: result.providerResponse,
        notificationId,
      },
      { status: 500 }
    );
  } catch (error) {
    console.error('[notifications/send] Unexpected error:', error);
    return jsonResponse({ success: false, error: 'Internal server error', status: 'failed' }, { status: 500 });
  }
}
