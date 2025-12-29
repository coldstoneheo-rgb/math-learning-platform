// scripts/run-migration.js
// Supabase migration 실행 스크립트

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 환경 변수에서 Supabase 설정 로드
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
  console.error('   .env.local 파일을 확인하세요.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  const migrationPath = path.join(__dirname, '../supabase/migrations/20251229_add_meta_profile.sql');

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration 파일을 찾을 수 없습니다:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('📦 Migration 실행 중...');
  console.log('   파일:', migrationPath);
  console.log('');

  // SQL을 개별 명령어로 분리하여 실행
  // (Supabase JS Client는 단일 쿼리만 지원하므로 rpc 사용)
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // exec_sql 함수가 없는 경우 직접 실행 시도
      console.log('⚠️  exec_sql 함수가 없습니다. SQL Editor에서 직접 실행이 필요합니다.');
      console.log('');
      console.log('='.repeat(60));
      console.log('📋 Supabase SQL Editor에서 아래 SQL을 실행하세요:');
      console.log('='.repeat(60));
      console.log('');
      console.log('1. Supabase 대시보드 접속: https://supabase.com/dashboard');
      console.log('2. 프로젝트 선택');
      console.log('3. SQL Editor 메뉴 클릭');
      console.log('4. 아래 SQL 복사하여 실행');
      console.log('');
      console.log('-'.repeat(60));
      console.log(sql);
      console.log('-'.repeat(60));
      return;
    }

    console.log('✅ Migration 완료!');
    console.log(data);
  } catch (err) {
    console.error('❌ Migration 실행 중 오류:', err.message);
    console.log('');
    console.log('='.repeat(60));
    console.log('📋 SQL Editor에서 직접 실행하세요:');
    console.log('='.repeat(60));
    console.log('');
    console.log('Supabase 대시보드 → SQL Editor → New Query → 아래 SQL 붙여넣기');
    console.log('');
  }
}

runMigration();
