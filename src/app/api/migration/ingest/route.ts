import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ingestLegacyData } from '@/lib/gemini';
import type { Student, StudentMetaProfile } from '@/types';

export const maxDuration = 60; // Vercel Pro 요금제 등에서 최대 실행 시간 60초 설정 (기본 10초~15초 우회)
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    
    // Auth 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { studentId, studentName, images, documentDate, documentType } = body;

    if (!studentId || !images || !images.length || !documentDate || !documentType) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    // 학생 메타프로필 조회
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('meta_profile')
      .eq('id', studentId)
      .single();

    if (studentError) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const currentProfile = student.meta_profile as StudentMetaProfile | null;

    // AI 잉제스천 실행
    const result = await ingestLegacyData(
      studentName,
      currentProfile,
      images,
      documentDate,
      documentType
    );

    // AI가 제안한 업데이트를 기존 프로필에 병합
    let updatedProfile: StudentMetaProfile;
    
    if (!currentProfile) {
      // 초기 상태일 경우 (기본 구조는 있어야 하지만, 마이그레이션이 첫 데이터라면)
      // 실제 앱 구조에선 baseline 등이 초기화되어 있어야 하므로 단순 할당이 위험할 수 있음
      // 편의상 넘어온 데이터를 기본으로 구성
      updatedProfile = {
        baseline: {
          assessmentDate: documentDate,
          initialLevel: { grade: 0, percentile: 0, evaluatedAt: documentDate },
          domainScores: [],
          initialStrengths: [],
          initialWeaknesses: [],
          initialLearningStyle: 'mixed'
        },
        errorSignature: result.updatedMetaProfile?.errorSignature || {
          primaryErrorTypes: [],
          signaturePatterns: [],
          domainVulnerability: [],
          lastUpdated: documentDate
        },
        absorptionRate: result.updatedMetaProfile?.absorptionRate || {
          overallScore: 50,
          byDomain: [],
          learningType: 'steady-grower',
          optimalConditions: [],
          recentTrend: [],
          lastUpdated: documentDate
        },
        solvingStamina: result.updatedMetaProfile?.solvingStamina || {
          overallScore: 50,
          optimalDuration: 60,
          accuracyBySequence: [],
          fatiguePattern: 'consistent',
          recoveryStrategies: [],
          lastUpdated: documentDate
        },
        metaCognitionLevel: result.updatedMetaProfile?.metaCognitionLevel || {
          overallScore: 50,
          subScores: {
            selfAssessmentAccuracy: 50,
            errorRecognition: 50,
            strategySelection: 50,
            timeManagement: 50
          },
          developmentStage: 'developing',
          improvementAreas: [],
          lastUpdated: documentDate
        },
        legacySignals: result.extractedSignals,
        lastUpdated: new Date().toISOString(),
        version: '1.0'
      };
    } else {
      updatedProfile = {
        ...currentProfile,
        ...result.updatedMetaProfile,
        // legacySignals 누적
        legacySignals: [
          ...(currentProfile.legacySignals || []),
          ...result.extractedSignals
        ],
        lastUpdated: new Date().toISOString()
      };
    }

    // DB 업데이트
    const { error: updateError } = await supabase
      .from('students')
      .update({ meta_profile: updatedProfile })
      .eq('id', studentId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      extractedSignals: result.extractedSignals
    });

  } catch (error) {
    console.error('Migration API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 서버 오류' },
      { status: 500 }
    );
  }
}
