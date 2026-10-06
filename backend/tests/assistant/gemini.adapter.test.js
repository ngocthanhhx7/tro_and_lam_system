import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeminiProvider } from '../../src/services/integrations/gemini/gemini.adapter.js';

test('configured Gemini adapter uses the official GenerateContent endpoint and keeps API key out of URL', async () => {
  let request;
  const provider = createGeminiProvider({
    apiKey: 'unit-test-key-do-not-use',
    model: 'models/gemini-2.5-flash',
    timeoutMs: 100,
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Grounded answer.' }] } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const result = await provider.reply({
    message: 'Question',
    approvedContext: [{ type: 'product', text: 'Published catalog facts only' }],
    history: [{ role: 'assistant', text: 'Earlier answer' }],
  });

  assert.equal(result.text, 'Grounded answer.');
  assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
  assert.equal(request.url.includes('unit-test-key-do-not-use'), false);
  assert.equal(request.options.headers['x-goog-api-key'], 'unit-test-key-do-not-use');
  const body = JSON.parse(request.options.body);
  assert.match(body.systemInstruction.parts[0].text, /không đáng tin cậy/iu);
  assert.deepEqual(body.contents.map(({ role }) => role), ['model', 'user']);
  assert.match(JSON.stringify(body), /Published catalog facts only/);
});

test('Gemini adapter is disabled without credentials and reports provider errors without response-body leakage', async () => {
  assert.equal(createGeminiProvider({}), null);
  const provider = createGeminiProvider({
    apiKey: 'unit-test-key-do-not-use', model: 'gemini-2.5-flash', timeoutMs: 100,
    fetchImpl: async () => new Response('private provider error body', { status: 429 }),
  });
  await assert.rejects(provider.reply({ message: 'Question', approvedContext: [], history: [] }), (error) => (
    error.code === 'GEMINI_QUOTA' && !error.message.includes('private provider error body')
  ));
});

test('Gemini adapter aborts its request after the configured timeout', async () => {
  const provider = createGeminiProvider({
    apiKey: 'unit-test-key-do-not-use', model: 'gemini-2.5-flash', timeoutMs: 5,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }),
  });
  await assert.rejects(provider.reply({ message: 'Question', approvedContext: [], history: [] }), (error) => error.code === 'GEMINI_TIMEOUT');
});
