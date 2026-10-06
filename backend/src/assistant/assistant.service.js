import { createHash } from 'node:crypto';
import { ServiceError, notFound } from '../utils/serviceError.js';
import { redactSensitiveText, safeSlug } from './assistant.security.js';
import { validateAssistantMessage } from './assistant.validators.js';

const CONVERSATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_HISTORY = 8;
const MAX_PRODUCTS = 4;
const MAX_STORIES = 2;
const MAX_OUTPUT_TOKENS = 600;

export const ASSISTANT_UNAVAILABLE_REPLY = 'Trợ lý tự động hiện chưa sẵn sàng. Bạn có thể tiếp tục xem danh mục hoặc yêu cầu nhân viên hỗ trợ.';
export const ASSISTANT_NO_CONTEXT_REPLY = 'Mình chưa tìm thấy thông tin công khai đã được duyệt cho câu hỏi này. Mình có thể chuyển bạn tới nhân viên hỗ trợ.';
export const ASSISTANT_RETRIEVAL_REPLY = 'Danh mục và câu chuyện đang tạm thời chưa truy cập được. Bạn có thể thử lại hoặc yêu cầu nhân viên hỗ trợ.';

function idOf(value) {
  return String(value?._id ?? value?.id ?? value ?? '');
}

function dateOf(value) {
  return value instanceof Date ? value : new Date(value);
}

function ownerFor(actor) {
  const role = actor?.role;
  const userId = actor?.id ?? actor?._id;
  if (userId && ['customer', 'staff', 'admin'].includes(role)) return { userId: String(userId) };
  if (actor?.assistantGuestHash && /^[a-f\d]{64}$/i.test(actor.assistantGuestHash)) {
    return { guestHash: actor.assistantGuestHash.toLowerCase() };
  }
  throw new ServiceError(401, 'AUTH_REQUIRED', 'Không thể xác minh quyền sở hữu cuộc trò chuyện');
}

function ownerKey(owner) {
  const identity = owner.userId ? `user:${owner.userId}` : `guest:${owner.guestHash}`;
  return createHash('sha256').update(identity).digest('hex');
}

function boundedText(value, limit) {
  return redactSensitiveText(value, { maxLength: limit });
}

function productContext(product) {
  if (!product || (product.status && product.status !== 'published')) return null;
  const name = boundedText(product.name, 240);
  if (!name) return null;
  const fields = {
    name,
    ...(product.description ? { description: boundedText(product.description, 900) } : {}),
    ...(product.material ? { material: boundedText(product.material, 200) } : {}),
    ...(product.dimensions ? { dimensions: boundedText(product.dimensions, 200) } : {}),
    ...(product.careInstructions ? { careInstructions: boundedText(product.careInstructions, 500) } : {}),
    ...(product.saleMode ? { saleMode: product.saleMode } : {}),
    ...(Number.isSafeInteger(product.priceVnd) && product.priceVnd > 0 ? { priceVnd: product.priceVnd } : {}),
    ...(typeof product.availableForPurchase === 'boolean' ? { availableForPurchase: product.availableForPurchase } : {}),
    ...(product.stockLabel ? { stockLabel: boundedText(product.stockLabel, 100) } : {}),
  };
  return {
    id: idOf(product),
    slug: product.slug,
    title: name,
    context: { type: 'product', product: fields },
    storyId: product.storyId ? idOf(product.storyId) : '',
  };
}

function contentBlockText(block) {
  if (!block || typeof block !== 'object') return '';
  if (typeof block.text === 'string') return boundedText(block.text, 1000);
  if (Array.isArray(block.items)) return block.items.map((item) => boundedText(item, 500)).join('\n');
  if (block.type === 'image') return [block.alt, block.caption].filter(Boolean).map((item) => boundedText(item, 300)).join(' — ');
  return '';
}

function storyContext(story) {
  if (!story || (story.status && story.status !== 'published')) return null;
  const title = boundedText(story.title, 240);
  if (!title) return null;
  const sections = (Array.isArray(story.sections) ? story.sections : []).slice(0, 12).map((section) => ({
    ...(section.heading ? { heading: boundedText(section.heading, 200) } : {}),
    body: (Array.isArray(section.body) ? section.body : []).slice(0, 12)
      .map(contentBlockText).filter(Boolean).join('\n'),
  })).filter((section) => section.body || section.heading);
  const fields = {
    title,
    ...(story.origin ? { origin: boundedText(story.origin, 600) } : {}),
    ...(story.artisan ? { artisan: boundedText(story.artisan, 150) } : {}),
    ...(Array.isArray(story.motifs) ? { motifs: story.motifs.slice(0, 10).map((item) => boundedText(item, 150)) } : {}),
    sections,
  };
  return {
    id: idOf(story),
    slug: story.slug,
    title,
    context: { type: 'story', story: fields },
  };
}

function publishedSources(products, stories) {
  const sources = [];
  for (const product of products) {
    if (sources.length >= MAX_PRODUCTS) break;
    if (!/^[a-f\d]{24}$/i.test(product.id) || !safeSlug(product.slug)) continue;
    sources.push({ id: product.id, type: 'product', title: product.title, href: `/san-pham/${product.slug}` });
  }
  for (const story of stories) {
    if (sources.length >= MAX_PRODUCTS + MAX_STORIES) break;
    if (!/^[a-f\d]{24}$/i.test(story.id) || !safeSlug(story.slug)) continue;
    sources.push({ id: story.id, type: 'story', title: story.title, href: `/cau-chuyen/${story.slug}` });
  }
  return sources;
}

function makeInMemoryUsageGuard() {
  const requestWindows = new Map();
  const dailyTokens = new Map();
  return Object.freeze({
    async consumeRequest(key, { at, limit, windowMs }) {
      const nowMs = at.getTime();
      const recent = (requestWindows.get(key) || []).filter((timestamp) => timestamp > nowMs - windowMs);
      if (recent.length >= limit) {
        requestWindows.set(key, recent);
        return false;
      }
      recent.push(nowMs);
      requestWindows.set(key, recent);
      return true;
    },
    async reserveDailyTokens(day, amount, limit) {
      if (!Number.isSafeInteger(limit) || limit < 1) return false;
      const current = dailyTokens.get(day) || 0;
      if (current + amount > limit) return false;
      dailyTokens.set(day, current + amount);
      for (const oldDay of dailyTokens.keys()) if (oldDay !== day) dailyTokens.delete(oldDay);
      return true;
    },
  });
}

function estimateTokens(value) {
  return Math.max(1, Math.ceil(JSON.stringify(value).length / 4));
}

function timeoutReply(provider, args, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Assistant request timeout')), timeoutMs);
  return Promise.race([
    Promise.resolve().then(() => provider.reply({ ...args, signal: controller.signal })),
    new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true })),
  ]).finally(() => clearTimeout(timer));
}

function shouldSuggestHandoff(message, fallback) {
  return fallback || /nhân\s*viên|người\s*thật|tư\s*vấn|liên\s*hệ|hỗ\s*trợ\s*viên/iu.test(message);
}

export function createAssistantService({
  assistantRepository,
  productPort,
  contentPort,
  aiProvider,
  usageGuard = makeInMemoryUsageGuard(),
  now = () => new Date(),
  config = {},
} = {}) {
  if (!assistantRepository
    || typeof assistantRepository.create !== 'function'
    || typeof assistantRepository.findOwned !== 'function'
    || typeof assistantRepository.append !== 'function') {
    throw new TypeError('P10 requires a persistent assistant conversation repository');
  }
  const ttlMs = Math.min(Math.max(Number(config.aiConversationTtlMs) || CONVERSATION_TTL_MS, 60_000), CONVERSATION_TTL_MS);
  const rateLimit = Math.min(Math.max(Number(config.assistantRateLimit) || 10, 1), 100);
  const rateWindowMs = Math.min(Math.max(Number(config.assistantRateWindowMs) || 15 * 60_000, 1_000), 24 * 60 * 60_000);
  const timeoutMs = Math.min(Math.max(Number(config.aiTimeoutMs) || 15_000, 100), 15_000);
  const dailyTokenBudget = Math.max(0, Math.floor(Number(config.aiDailyBudget) || 0));
  const maxOutputTokens = Math.min(Math.max(Number(config.aiMaxOutputTokens) || MAX_OUTPUT_TOKENS, 64), 800);

  async function retrieveApprovedContext(message) {
    if (typeof productPort?.searchPublished !== 'function'
      || typeof contentPort?.getPublishedStoryById !== 'function') {
      return { available: false, products: [], stories: [] };
    }
    const query = boundedText(message, 120);
    const result = await productPort.searchPublished({ q: query, page: 1, limit: MAX_PRODUCTS });
    const rawProducts = Array.isArray(result) ? result : result?.items;
    if (!Array.isArray(rawProducts)) throw new Error('Published catalog port returned an invalid result');
    const products = rawProducts.map(productContext).filter(Boolean).slice(0, MAX_PRODUCTS);
    const stories = [];
    for (const product of products) {
      if (stories.length >= MAX_STORIES || !/^[a-f\d]{24}$/i.test(product.storyId)) continue;
      if (stories.some((story) => story.id === product.storyId)) continue;
      try {
        const story = storyContext(await contentPort.getPublishedStoryById(product.storyId));
        if (story) stories.push(story);
      } catch (error) {
        if (error?.status !== 404) throw error;
      }
    }
    return { available: true, products, stories };
  }

  async function appendMessage(conversationId, owner, role, content, at) {
    const expiresAt = new Date(at.getTime() + ttlMs);
    const updated = await assistantRepository.append(conversationId, owner, {
      role,
      content: boundedText(content, 4000),
      createdAt: at,
    }, { expiresAt, consentAt: at, at });
    if (!updated) throw notFound();
    return updated;
  }

  async function sendMessage({ actor, input } = {}) {
    const request = validateAssistantMessage(input);
    const owner = ownerFor(actor);
    const at = dateOf(now());
    const requestKey = ownerKey(owner);
    const allowed = await usageGuard.consumeRequest(requestKey, { at, limit: rateLimit, windowMs: rateWindowMs });
    if (!allowed) throw new ServiceError(429, 'RATE_LIMITED', 'Bạn gửi câu hỏi quá nhanh. Vui lòng thử lại sau.');

    let conversation;
    let previousMessages = [];
    if (request.conversationId) {
      conversation = await assistantRepository.findOwned(request.conversationId, owner, at);
      if (!conversation) throw notFound();
      previousMessages = (conversation.messagesRedacted || []).slice(-MAX_HISTORY)
        .filter((item) => ['user', 'assistant'].includes(item.role))
        .map((item) => ({ role: item.role, text: boundedText(item.content, 4000) }));
    } else {
      conversation = await assistantRepository.create(owner, { expiresAt: new Date(at.getTime() + ttlMs), consentAt: at });
    }
    const conversationId = idOf(conversation);
    if (!/^[a-f\d]{24}$/i.test(conversationId)) throw new ServiceError(503, 'AI_UNAVAILABLE', 'Không thể lưu cuộc trò chuyện an toàn');

    await appendMessage(conversationId, owner, 'user', redactSensitiveText(request.message), at);

    let reply = ASSISTANT_UNAVAILABLE_REPLY;
    let sources = [];
    let providerUsed = false;
    if (aiProvider && config.aiEnabled !== false) {
      let retrieval;
      try {
        retrieval = await retrieveApprovedContext(request.message);
      } catch {
        retrieval = null;
      }
      if (retrieval?.available) {
        const usableProducts = retrieval.products.filter((item) => /^[a-f\d]{24}$/i.test(item.id) && safeSlug(item.slug));
        const usableStories = retrieval.stories.filter((item) => /^[a-f\d]{24}$/i.test(item.id) && safeSlug(item.slug));
        const approvedContext = [...usableProducts, ...usableStories].map((item) => item.context);
        sources = publishedSources(usableProducts, usableStories);
        if (approvedContext.length > 0) {
          const history = previousMessages.map((item) => ({ ...item, text: redactSensitiveText(item.text) }));
          const estimate = estimateTokens({ message: request.message, history, approvedContext }) + maxOutputTokens;
          const day = at.toISOString().slice(0, 10);
          const withinBudget = await usageGuard.reserveDailyTokens(day, estimate, dailyTokenBudget);
          if (withinBudget) {
            try {
              const result = await timeoutReply(aiProvider, {
                message: redactSensitiveText(request.message),
                approvedContext,
                history,
                maxOutputTokens,
              }, timeoutMs);
              const candidate = redactSensitiveText(result?.text, { maxLength: 4000 });
              if (!candidate) throw new Error('Empty assistant provider response');
              reply = candidate;
              providerUsed = true;
            } catch {
              reply = ASSISTANT_UNAVAILABLE_REPLY;
              sources = [];
            }
          } else {
            reply = ASSISTANT_UNAVAILABLE_REPLY;
            sources = [];
          }
        } else {
          reply = ASSISTANT_NO_CONTEXT_REPLY;
        }
      } else {
        reply = ASSISTANT_RETRIEVAL_REPLY;
      }
    }

    await appendMessage(conversationId, owner, 'assistant', reply, dateOf(now()));
    return {
      conversationId,
      reply,
      sources,
      handoffSuggested: shouldSuggestHandoff(request.message, !providerUsed),
    };
  }

  async function requireOwnedConversation(conversationId, actor) {
    if (typeof conversationId !== 'string' || !/^[a-f\d]{24}$/i.test(conversationId)) throw notFound();
    let owner;
    try { owner = ownerFor(actor); } catch { throw notFound(); }
    const conversation = await assistantRepository.findOwned(conversationId, owner, dateOf(now()));
    if (!conversation) throw notFound();
    return { conversation, owner };
  }

  return Object.freeze({
    sendMessage,
    async assertConversationOwner(conversationId, actor) {
      await requireOwnedConversation(conversationId, actor);
      return true;
    },
    async getSharedTranscript(conversationId, actor) {
      const { conversation } = await requireOwnedConversation(conversationId, actor);
      if (!conversation.consentAt) throw new ServiceError(403, 'FORBIDDEN', 'Chưa có sự đồng ý chia sẻ cuộc trò chuyện');
      return (conversation.messagesRedacted || []).slice(-MAX_HISTORY).map((item) => (
        `${item.role === 'user' ? 'Khách' : 'Trợ lý'}: ${redactSensitiveText(item.content, { maxLength: 1200 })}`
      )).join('\n').slice(-5000);
    },
  });
}

export function createInMemoryAssistantUsageGuard() {
  return makeInMemoryUsageGuard();
}
