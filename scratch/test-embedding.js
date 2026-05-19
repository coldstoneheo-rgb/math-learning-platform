require('dotenv').config({ path: '.env.local' });
const { generateEmbedding } = require('./src/lib/embedding-service.ts');

async function test() {
  try {
    const tsNode = require('ts-node');
    tsNode.register();
    const { generateEmbedding } = require('./src/lib/embedding-service');
    console.log('Testing embedding...');
    const result = await generateEmbedding('테스트 임베딩입니다.');
    console.log('Success, length:', result.length);
  } catch (err) {
    console.error('Error in generateEmbedding:', err);
  }
}

test();
