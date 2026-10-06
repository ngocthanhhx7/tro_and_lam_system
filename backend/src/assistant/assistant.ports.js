export function createAssistantTranscriptPort(assistantService) {
  if (typeof assistantService?.assertConversationOwner !== 'function'
    || typeof assistantService?.getSharedTranscript !== 'function') {
    throw new TypeError('P10 assistant service must expose ownership-safe transcript reads');
  }
  return Object.freeze({
    assertConversationOwner: (conversationId, actor) => assistantService.assertConversationOwner(conversationId, actor),
    getSharedTranscript: (conversationId, actor) => assistantService.getSharedTranscript(conversationId, actor),
  });
}
