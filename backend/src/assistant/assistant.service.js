import { createHash } from 'node:crypto';
import { ServiceError, notFound } from '../utils/serviceError.js';
import { redactSensitiveText, safeSlug } from './assistant.security.js';
import { validateAssistantMessage } from './assistant.validators.js';
import { createMemoryAssistantDailyUsage } from './assistant.usage.js';

const CONVERSATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_HISTORY = 8;
const MAX_PRODUCTS = 4;
const MAX_STORIES = 2;
const MAX_OUTPUT_TOKENS = 600;
const CATALOG_QUERY_STOP_WORDS = new Set([
  'a', 'anh', 'bao', 'ban', 'bạn', 'bằng', 'các', 'có', 'của', 'cho', 'chủ', 'chị',
  'đang', 'đã', 'được', 'em', 'giá', 'giup', 'giúp', 'hay', 'hỏi', 'không', 'la', 'là',
  'loai', 'loại', 'mình', 'mua', 'nào', 'này', 'những', 'nhiêu', 'phẩm', 'sản', 'sao',
  'tìm', 'tiền', 'tôi', 'thế', 'thông', 'tin', 'về', 'vậy', 'với', 'xem', 'xin', 'ạ',
]);

export const ASSISTANT_UNAVAILABLE_REPLY = 'Đậu Đậu đang hơi bí ở câu này rồi 🌿 Mình chưa có đủ thông tin để tư vấn chắc chắn. Bạn có thể xem sản phẩm bên dưới, hoặc nhờ nhân viên cùng tìm câu trả lời nhé.';
export const ASSISTANT_NO_CONTEXT_REPLY = 'Câu này Đậu Đậu chưa có thông tin chắc chắn, nên mình không đoán bừa đâu nè 🌿 Bạn nói rõ thêm điều muốn tìm hiểu nhé? Nếu cần, mình có thể chuyển câu hỏi tới nhân viên.';
export const ASSISTANT_RETRIEVAL_REPLY = 'Ối, Đậu Đậu chưa mở được thông tin sản phẩm lúc này 🌿 Bạn thử lại sau một chút nhé; nếu đang cần gấp, mình có thể chuyển câu hỏi tới nhân viên.';
export const ASSISTANT_GREETING_REPLY = 'Chào bạn, mình là **Đậu Đậu**, tinh linh gốm của TRO & LAM nè! 🌿 Mình có thể giúp bạn chọn gốm, tìm hiểu hoa văn, cách đặt hàng và tra cứu đơn. Hôm nay mình tìm món gốm nào cùng bạn nhỉ?';
const ASSISTANT_CAPABILITIES_REPLY = 'Đậu Đậu nhỏ xíu mà cũng có vài món nghề đó nha ✨\n\n- **Chọn gốm, tìm quà:** cùng bạn tìm sản phẩm theo nhu cầu và thông tin cửa hàng đang có.\n- **Tìm hiểu sản phẩm:** chất liệu, kích thước, cách chăm gốm và câu chuyện đã được giới thiệu.\n- **Hỗ trợ mua hàng:** hướng dẫn đặt hàng, dùng voucher, phí giao hàng và thanh toán.\n- **Theo dõi đơn:** hướng dẫn tra cứu bằng mã đơn, hoặc xem đơn của bạn khi đã đăng nhập.\n\nBạn đang chọn gốm cho **nhà mình hay làm quà** nè? 🌿';

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

function isGreeting(value) {
  const normalized = value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/[.!?,;:]/gu, ' ').trim().replace(/\s+/gu, ' ');
  return /^(?:xin chao|chao|hello|hi|hey|alo)(?: ban)?$/u.test(normalized);
}

function conversationalReply(value) {
  const text = value.normalize('NFD').replace(/\p{Diacritic}/gu, '').replaceAll('đ', 'd').replaceAll('Đ', 'D').toLowerCase()
    .replace(/[.!?,;:]/gu, ' ').trim().replace(/\s+/gu, ' ');
  if (/^(?:(?:cho (?:toi|minh|em) (?:biet|hoi)|vay|the) )?(?:ban|dau dau|men|cau|tro ly)(?: oi)? (?:co the |se )?(?:lam (?:duoc )?(?:gi|nhung gi)|giup (?:duoc )?(?:(?:toi|minh|em) )?(?:duoc )?(?:gi|nhung gi)|ho tro (?:duoc )?(?:gi|nhung gi))(?: (?:nao|nhi|vay|the|a|nhe|khong))*$/u.test(text)
    || /^(?:ban|dau dau|men|cau) la ai(?: (?:vay|the|nhi|a))*$/u.test(text)) return ASSISTANT_CAPABILITIES_REPLY;
  if (/^(?:(?:cam on|thank you|thanks)(?: (?:ban|dau dau|men|nhe|nha|nhieu|a|lam|rat))*|da cam on(?: (?:ban|dau dau|men|nhe|nha|a))*)$/u.test(text)) {
    return 'Có gì đâu nè, Đậu Đậu vui vì giúp được bạn ✨ Khi cần chọn gốm hay hỏi chuyện đặt hàng, cứ gọi mình nhé!';
  }
  return null;
}

function catalogSearchQuery(message) {
  const words = boundedText(message, 120)
    .replace(/[^\p{L}\p{N}-]+/gu, ' ')
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  const meaningfulWords = words.filter((word) => {
    const normalized = word.normalize('NFC').toLocaleLowerCase('vi-VN');
    return !CATALOG_QUERY_STOP_WORDS.has(normalized);
  });
  return meaningfulWords.join(' ');
}

function catalogFallbackReply(approvedContext) {
  const care = approvedContext.find(item => item.type === 'customer-care');
  if (care) {
    const methods = care.paymentMethods.map(method => method === 'cod' ? 'COD (thanh toán khi nhận hàng)' : 'PayOS (quét QR)').join(' hoặc ');
    const fees = care.shippingZones.filter(zone => Number.isSafeInteger(zone.feeVnd)).slice(0, 5)
      .map(zone => `- ${(zone.provinceNames || []).includes('*') ? 'Toàn quốc' : (zone.provinceNames || []).join(', ') || 'Vùng giao hàng được cấu hình'}: **${new Intl.NumberFormat('vi-VN').format(zone.feeVnd)} đ**`).join('\n');
    return `Đậu Đậu gửi bạn thông tin đang có nhé 🌿\n\n${methods ? `- Thanh toán: **${methods}**.\n` : '- Thanh toán đang chờ cửa hàng cấu hình.\n'}${fees ? `- Phí theo vùng:\n${fees}\n` : ''}- Bạn có thể mua không cần đăng nhập và **nhập mã voucher tại thanh toán**.\n\nPhí cuối cùng và điều kiện mã sẽ được hệ thống kiểm tra theo địa chỉ, giỏ hàng của bạn. Với PayOS, tiếp tục sang trang thanh toán để quét QR nhé.`;
  }
  const products = approvedContext
    .filter((item) => item?.type === 'product' && typeof item.product?.name === 'string')
    .slice(0, MAX_PRODUCTS)
    .map(({ product }) => {
      const details = [product.name];
      if (Number.isSafeInteger(product.priceVnd) && product.priceVnd > 0) {
        details.push(`${new Intl.NumberFormat('vi-VN').format(product.priceVnd)} VND`);
      }
      if (product.material) details.push(boundedText(product.material, 200));
      if (product.dimensions) details.push(boundedText(product.dimensions, 200));
      return `• ${details.join(' — ')}`;
    });
  if (!products.length) return ASSISTANT_UNAVAILABLE_REPLY;
  return `Đậu Đậu chưa tư vấn chi tiết được lúc này, nhưng đã tìm thấy vài món trong cửa hàng để bạn xem trước nè 🌿\n\n${products.join('\n')}\n\nBạn mở từng sản phẩm bên dưới để xem kỹ hơn nhé. Nhân viên cũng sẵn sàng tư vấn thêm nếu bạn cần.`;
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
  customerCarePort,
  dailyUsage = createMemoryAssistantDailyUsage(),
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
    // Catalog search matches phrases literally. Remove common question words so
    // "Hũ trà có giá bao nhiêu?" searches for the published product name.
    const query = catalogSearchQuery(message);
    const result = await productPort.searchPublished({ q: query, page: 1, limit: MAX_PRODUCTS });
    const rawProducts = Array.isArray(result) ? result : result?.items;
    if (!Array.isArray(rawProducts)) throw new Error('Published catalog port returned an invalid result');
    const products = rawProducts.map(productContext).filter(Boolean).slice(0, MAX_PRODUCTS);
    const storyIds = [...new Set(products.map(product => product.storyId).filter(id => /^[a-f\d]{24}$/i.test(id)))];
    const stories = (await Promise.all(storyIds.map(async storyId => {
      try {
        return storyContext(await contentPort.getPublishedStoryById(storyId));
      } catch (error) {
        if (error?.status !== 404) throw error;
        return null;
      }
    }))).filter(Boolean).slice(0, MAX_STORIES);
    return { available: true, products, stories };
  }

  async function appendMessage(conversationId, owner, role, content, at, providerVisible = true) {
    const expiresAt = new Date(at.getTime() + ttlMs);
    const updated = await assistantRepository.append(conversationId, owner, {
      role,
      content: boundedText(content, 4000),
      createdAt: at,
      providerVisible,
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
        .filter((item) => item.providerVisible !== false && ['user', 'assistant'].includes(item.role))
        .map((item) => ({ role: item.role, text: boundedText(item.content, 4000) }));
    }
    const usage = await dailyUsage.consume(actor?.assistantDeviceHash || ownerKey(owner), at);
    if (!conversation) {
      conversation = await assistantRepository.create(owner, { expiresAt: new Date(at.getTime() + ttlMs), consentAt: at });
    }
    const conversationId = idOf(conversation);
    if (!/^[a-f\d]{24}$/i.test(conversationId)) throw new ServiceError(503, 'AI_UNAVAILABLE', 'Không thể lưu cuộc trò chuyện an toàn');

    const orderQuestion = /đơn\s*(hàng)?|theo\s*dõi|giao\s*hàng.*đến/iu.test(request.message);
    await appendMessage(conversationId, owner, 'user', redactSensitiveText(request.message), at, !orderQuestion);

    const localReply = isGreeting(request.message) ? ASSISTANT_GREETING_REPLY : conversationalReply(request.message);
    if (localReply) {
      const reply = localReply;
      await appendMessage(conversationId, owner, 'assistant', reply, dateOf(now()));
      return { conversationId, reply, sources: [], handoffSuggested: false, usage };
    }

    // Account/order information stays on the server: never send it to Gemini.
    if (orderQuestion) {
      const labels = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', processing: 'Đang xử lý', preparing: 'Đang chuẩn bị', shipping: 'Đang giao', shipped: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy', returned: 'Đã hoàn trả', return_requested: 'Yêu cầu trả hàng' };
      const code = request.message.toUpperCase().match(/\bTL-[A-Z0-9-]{4,29}\b/u)?.[0];
      let reply;
      let sources = [{ type: 'guide', id: 'order-tracking', title: 'Theo dõi đơn hàng', href: '/tra-cuu-don-hang' }];
      try {
        if (code && customerCarePort?.getPublicOrderProgress) {
          const order = await customerCarePort.getPublicOrderProgress(code);
          reply = `Mình kiểm tra được rồi nè 📦 Trạng thái hiện tại: **${labels[order.status] || 'Đang cập nhật'}**.\n\nBạn mở trang theo dõi bên dưới để xem tiến trình mới nhất nhé. Đây là trạng thái đơn, chưa phải xác nhận thanh toán.`;
        } else if (actor?.role === 'customer' && /của\s*(tôi|mình|em)|đơn\s*(hàng)?\s*(tôi|mình)|gần\s*đây/iu.test(request.message) && customerCarePort?.listOwnOrders) {
          const orders = await customerCarePort.listOwnOrders(actor, { page: 1, limit: 3 });
          reply = orders.items.length ? `Mình tìm thấy các đơn gần đây của bạn nè 📦\n\n${orders.items.map(order => `- **${order.code}**: ${labels[order.status] || 'Đang cập nhật'}`).join('\n')}\n\nBạn mở Đơn mua để xem chi tiết nhé.` : 'Bạn chưa có đơn hàng nào trong tài khoản này. Mình cùng chọn một món gốm ưng ý nhé? 🌿';
          sources = [{ type: 'guide', id: 'own-orders', title: 'Đơn mua của tôi', href: '/tai-khoan/don-hang' }];
        } else if (/tra\s*cứu|theo\s*dõi|đơn\s*(hàng)?\s*(tôi|mình)|của\s*(tôi|mình)/iu.test(request.message)) {
          reply = 'Bạn gửi **mã đơn bắt đầu bằng TL-** hoặc mở trang Theo dõi đơn hàng bên dưới nhé 📦 Không cần gửi địa chỉ, số điện thoại hay thông tin thanh toán đâu nè.';
        }
      } catch (error) {
        reply = error?.status === 404 ? 'Mình chưa tìm thấy mã đơn này. Bạn kiểm tra lại mã trong email xác nhận, hoặc mở trang theo dõi bên dưới nhé 📦' : 'Mình chưa kiểm tra được đơn lúc này. Bạn mở trang theo dõi hoặc nhờ nhân viên hỗ trợ nhé.';
      }
      if (reply) {
        await appendMessage(conversationId, owner, 'assistant', reply, dateOf(now()), false);
        return { conversationId, reply, sources, handoffSuggested: false, usage };
      }
    }

    let reply = ASSISTANT_UNAVAILABLE_REPLY;
    let sources = [];
    let providerUsed = false;
    let retrieval;
    try {
      const careQuestion = /ship|giao\s*hàng|vận\s*chuyển|thanh\s*toán|payos|cod|voucher|đặt\s*hàng|mua\s*hàng/iu.test(request.message);
      if (careQuestion) {
        const options = await customerCarePort?.getCheckoutOptions?.();
        retrieval = { available: true, products: [], stories: [], care: {
          type: 'customer-care',
          checkoutConfigured: options?.checkoutConfigured === true,
          paymentMethods: (options?.paymentMethods || []).filter(method => ['cod', 'payos'].includes(method)),
          shippingZones: (options?.shippingZones || []).slice(0, 63).map(zone => ({ provinceNames: zone.provinceNames, feeVnd: zone.feeVnd })),
          instructions: 'Khách có thể mua không cần đăng nhập. Chọn sản phẩm và số lượng ở giỏ, điền địa chỉ và nhập mã voucher tại thanh toán. Ví voucher chỉ dành cho tài khoản đăng nhập. Phí và điều kiện mã được kiểm tra tự động trước khi tạo đơn. Nếu chọn PayOS, tiếp tục tới trang thanh toán để quét QR; chỉ xác nhận thanh toán khi hệ thống đối soát thành công. Không cam kết thời gian giao hay chính sách đổi trả chưa được cung cấp.',
        } };
      } else {
        retrieval = await retrieveApprovedContext(request.message);
        if (!retrieval.products.length && !retrieval.stories.length && /tư\s*vấn|chọn|gợi\s*ý|quà|bộ\s*sưu\s*tập/iu.test(request.message)) retrieval = await retrieveApprovedContext('');
      }
    } catch {
      retrieval = null;
    }
    if (!retrieval?.available) {
      reply = ASSISTANT_RETRIEVAL_REPLY;
    } else {
      const usableProducts = retrieval.products.filter((item) => /^[a-f\d]{24}$/i.test(item.id) && safeSlug(item.slug));
      const usableStories = retrieval.stories.filter((item) => /^[a-f\d]{24}$/i.test(item.id) && safeSlug(item.slug));
      const approvedContext = [...usableProducts, ...usableStories].map((item) => item.context);
      if (retrieval.care) approvedContext.push(retrieval.care);
      sources = publishedSources(usableProducts, usableStories);
      if (approvedContext.length === 0) {
        reply = ASSISTANT_NO_CONTEXT_REPLY;
      } else {
        const history = previousMessages.map((item) => ({ ...item, text: redactSensitiveText(item.text) }));
        const estimate = estimateTokens({ message: request.message, history, approvedContext }) + maxOutputTokens;
        const day = at.toISOString().slice(0, 10);
        const withinBudget = aiProvider && config.aiEnabled !== false
          ? await usageGuard.reserveDailyTokens(day, estimate, dailyTokenBudget)
          : false;
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
            reply = catalogFallbackReply(approvedContext);
          }
        } else {
          reply = catalogFallbackReply(approvedContext);
        }
      }
    }

    await appendMessage(conversationId, owner, 'assistant', reply, dateOf(now()));
    return {
      conversationId,
      reply,
      sources,
      handoffSuggested: shouldSuggestHandoff(request.message, !providerUsed),
      usage,
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
