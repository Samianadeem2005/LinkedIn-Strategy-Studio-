const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const keyMatch = envContent.match(/GEMINI_API_KEY=(.+)/);
const keys = keyMatch ? keyMatch[1].split(',').map(k => k.trim()).filter(Boolean) : [];

console.log('Testing Keys count:', keys.length);

const testModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-3.6-flash'];

async function test() {
  for (const modelName of testModels) {
    console.log(`\n--- Testing Model: ${modelName} ---`);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: modelName });
        const res = await model.generateContent('Hello! Test ping.');
        console.log(`[SUCCESS] Key #${i + 1} with ${modelName}:`, res.response.text().trim().slice(0, 50));
        break;
      } catch (err) {
        console.log(`[FAILED] Key #${i + 1} with ${modelName}:`, err.message);
      }
    }
  }
}

test();
