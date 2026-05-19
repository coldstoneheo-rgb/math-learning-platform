import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { generateEmbedding } from '../src/lib/embedding-service';

async function main() {
  try {
    const result = await generateEmbedding('테스트');
    console.log('Success, length =', result.length);
  } catch (err) {
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
  }
}

main();
