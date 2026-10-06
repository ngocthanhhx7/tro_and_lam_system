import { requestJson } from '../httpClient.js';

export async function sendAssistantMessage({ conversationId, message }, { signal } = {}) {
  const body = { message, consent: true };
  if (conversationId) body.conversationId = conversationId;
  const response = await requestJson('/assistant/messages', { method: 'POST', body, signal });
  return response?.data;
}

export async function requestAssistantHandoff({ conversationId, shareTranscript, contact, orderId }, { signal } = {}) {
  const body = { conversationId, shareTranscript: Boolean(shareTranscript), contact };
  if (orderId) body.orderId = orderId;
  const response = await requestJson('/assistant/handoffs', { method: 'POST', body, signal });
  return response?.data;
}
