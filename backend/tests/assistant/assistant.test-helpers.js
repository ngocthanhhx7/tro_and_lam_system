export class MemoryAssistantRepository {
  #documents = new Map();
  #nextId = 1;

  #owned(document, owner) {
    if (owner.userId) return document.ownerUserId === owner.userId;
    return Boolean(owner.guestHash) && document.guestHash === owner.guestHash;
  }

  async create(owner, { expiresAt, consentAt }) {
    const id = `64f0000000000000000000${String(this.#nextId++).padStart(2, '0')}`;
    const document = {
      id,
      ...(owner.userId ? { ownerUserId: owner.userId } : { guestHash: owner.guestHash }),
      messagesRedacted: [],
      expiresAt,
      ...(consentAt ? { consentAt } : {}),
    };
    this.#documents.set(id, document);
    return structuredClone(document);
  }

  async findOwned(id, owner, at) {
    const document = this.#documents.get(String(id));
    if (!document || !this.#owned(document, owner) || document.expiresAt <= at) return null;
    return structuredClone(document);
  }

  async append(id, owner, message, { expiresAt, consentAt, at = new Date() }) {
    const document = this.#documents.get(String(id));
    if (!document || !this.#owned(document, owner) || document.expiresAt <= at) return null;
    document.messagesRedacted.push(structuredClone(message));
    document.messagesRedacted = document.messagesRedacted.slice(-12);
    document.expiresAt = expiresAt;
    if (consentAt) document.consentAt = consentAt;
    return structuredClone(document);
  }

  async inspect(id) {
    const document = this.#documents.get(String(id));
    return document ? structuredClone(document) : null;
  }
}

export const USER = Object.freeze({ id: '64f000000000000000000099', role: 'customer', status: 'active' });
export const GUEST = Object.freeze({ kind: 'guest', role: 'guest', assistantGuestHash: 'a'.repeat(64) });

export function publishedProduct(overrides = {}) {
  return {
    id: '64f000000000000000000011',
    slug: 'hu-tra-lam-vien',
    name: 'Hũ trà Lam Viên',
    description: 'Hũ trà gốm dáng nhỏ, thông tin đã duyệt.',
    material: 'Gốm Chu Đậu',
    saleMode: 'buy',
    priceVnd: 640000,
    availableForPurchase: true,
    storyId: '64f000000000000000000021',
    ...overrides,
  };
}

export function publishedStory(overrides = {}) {
  return {
    id: '64f000000000000000000021',
    slug: 'hoa-van-va-dat',
    title: 'Hoa văn và đất',
    locale: 'vi',
    status: 'published',
    origin: 'Nội dung đã được biên tập và công bố.',
    motifs: ['Hoa văn truyền thống'],
    sections: [{ heading: 'Câu chuyện', body: [{ type: 'paragraph', text: 'Mô tả được chủ nội dung duyệt.' }] }],
    ...overrides,
  };
}
