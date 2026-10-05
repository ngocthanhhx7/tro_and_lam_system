import { randomBytes } from 'node:crypto';
import { conflict, notFound } from '../utils/serviceError.js';
import {
  normalizeContentDocument,
  validatePageWrite,
  validateReasonVersion,
  validateStoryWrite,
  validateNfcTagCreate,
} from './content.validators.js';

const idOf = (value) => String(value?._id ?? value?.id ?? value ?? '');
const plain = (value) => (value && typeof value.toObject === 'function' ? value.toObject() : value);
const duplicateKey = (error) => error?.code === 11000 || error?.code === 11001;

function makeAudit(actor, action, targetType, targetId, { reasonCode, changesRedacted } = {}) {
  return {
    actorId: actor?.id,
    actorRole: actor?.role,
    requestId: actor?.requestId,
    action,
    targetType,
    targetId: targetId ? String(targetId) : undefined,
    outcome: 'success',
    ...(reasonCode ? { reasonCode } : {}),
    ...(changesRedacted ? { changesRedacted } : {}),
  };
}

export function createContentService({
  Story,
  Page,
  NfcTag,
  connection = Story?.db,
  productPort,
  auditPort,
  idGenerator = () => randomBytes(16).toString('hex'),
} = {}) {
  if (!Story || !Page || !NfcTag || !connection?.transaction) throw new TypeError('P08 needs Mongo models and a transaction-capable connection');
  if (typeof productPort?.getPublishedProductsByIds !== 'function'
    || typeof productPort?.getAdminProductReferencesByIds !== 'function') {
    throw new TypeError('P08 needs the P04 published/admin product reference ports');
  }
  if (typeof auditPort?.appendAudit !== 'function') throw new TypeError('P08 needs the P09 audit port');

  async function transact(work) {
    return connection.transaction(async (session) => work(session));
  }

  async function appendAudit(session, event) {
    await auditPort.appendAudit(event, { session });
  }

  async function requireStoryProducts(productIds, { publishedOnly = false, session } = {}) {
    if (!productIds.length) return { products: [], missing: [] };
    const find = publishedOnly ? productPort.getPublishedProductsByIds : productPort.getAdminProductReferencesByIds;
    const products = await find(productIds, { session });
    const found = new Set((products || []).map((product) => idOf(product)));
    const missing = productIds.filter((id) => !found.has(id));
    return { products: products || [], missing };
  }

  async function assertPublishedStoryContent(input, session) {
    if (!input.origin.trim() || input.sections.length === 0 || !input.sections.some((section) => section.body.length > 0)) {
      throw conflict('INVALID_TRANSITION', 'Cần có nguồn và nội dung trước khi xuất bản câu chuyện');
    }
    const result = await requireStoryProducts(input.productIds, { publishedOnly: true, session });
    if (result.missing.length) throw conflict('INVALID_TRANSITION', 'Chỉ liên kết sản phẩm đang công khai khi xuất bản câu chuyện');
  }

  async function assertPublishedPageContent(input) {
    if (input.blocks.length === 0) throw conflict('INVALID_TRANSITION', 'Cần có nội dung trước khi xuất bản trang');
  }

  async function replaceVersioned(model, id, expectedVersion, values, session) {
    const updated = await model.findOneAndUpdate(
      { _id: id, version: expectedVersion },
      { $set: values, $inc: { version: 1 } },
      { new: true, runValidators: true, session },
    );
    if (updated) return updated;
    const exists = await model.findById(id).session(session).select({ _id: 1 }).lean();
    if (!exists) throw notFound();
    throw conflict('VERSION_CONFLICT', 'Dữ liệu đã thay đổi. Hãy tải lại và thử lại');
  }

  async function archiveVersioned(model, id, expectedVersion, session) {
    return replaceVersioned(model, id, expectedVersion, { status: 'archived' }, session);
  }

  async function paginate(model, query, { status, page, limit }) {
    const filter = status ? { status } : {};
    const [documents, total] = await Promise.all([
      model.find(filter).sort({ updatedAt: -1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      model.countDocuments(filter),
    ]);
    return {
      items: documents.map(normalizeContentDocument),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async function createStory(body, actor) {
    const input = validateStoryWrite(body);
    delete input.expectedVersion;
    try {
      const story = await transact(async (session) => {
        if (input.status === 'published') await assertPublishedStoryContent(input, session);
        else {
          const { missing } = await requireStoryProducts(input.productIds, { session });
          if (missing.length) throw conflict('INVALID_TRANSITION', 'Một hoặc nhiều sản phẩm liên kết không tồn tại');
        }
        const [created] = await Story.create([{ ...input, version: 0, ...(input.status === 'published' ? { publishedAt: new Date() } : {}) }], { session });
        await appendAudit(session, makeAudit(actor, 'content.story.create', 'story', created._id, {
          changesRedacted: { status: created.status, locale: created.locale },
        }));
        return created;
      });
      return normalizeContentDocument(story);
    } catch (error) {
      if (duplicateKey(error)) throw conflict('VERSION_CONFLICT', 'Slug và ngôn ngữ này đã tồn tại');
      throw error;
    }
  }

  async function updateStory(id, body, actor) {
    const input = validateStoryWrite(body, { update: true });
    const values = { ...input };
    delete values.expectedVersion;
    if (input.status === 'published') values.publishedAt = new Date();
    else values.publishedAt = undefined;
    try {
      const story = await transact(async (session) => {
        const previous = await Story.findById(id).session(session).lean();
        if (!previous) throw notFound();
        if (input.status === 'published') await assertPublishedStoryContent(input, session);
        else {
          const { missing } = await requireStoryProducts(input.productIds, { session });
          if (missing.length) throw conflict('INVALID_TRANSITION', 'Một hoặc nhiều sản phẩm liên kết không tồn tại');
        }
        const updated = await replaceVersioned(Story, id, input.expectedVersion, values, session);
        await appendAudit(session, makeAudit(actor, 'content.story.update', 'story', id, {
          changesRedacted: { fromStatus: previous.status, toStatus: updated.status, locale: updated.locale },
        }));
        return updated;
      });
      return normalizeContentDocument(story);
    } catch (error) {
      if (duplicateKey(error)) throw conflict('VERSION_CONFLICT', 'Slug và ngôn ngữ này đã tồn tại');
      throw error;
    }
  }

  async function archiveStory(id, expectedVersion, actor) {
    return transact(async (session) => {
      const updated = await archiveVersioned(Story, id, expectedVersion, session);
      await appendAudit(session, makeAudit(actor, 'content.story.archive', 'story', id, {
        changesRedacted: { toStatus: 'archived' },
      }));
      return normalizeContentDocument(updated);
    });
  }

  async function createPage(body, actor) {
    const input = validatePageWrite(body);
    delete input.expectedVersion;
    try {
      const page = await transact(async (session) => {
        if (input.status === 'published') await assertPublishedPageContent(input);
        const [created] = await Page.create([{ ...input, version: 0 }], { session });
        await appendAudit(session, makeAudit(actor, 'content.page.create', 'page', created._id, {
          changesRedacted: { status: created.status, locale: created.locale },
        }));
        return created;
      });
      return normalizeContentDocument(page);
    } catch (error) {
      if (duplicateKey(error)) throw conflict('VERSION_CONFLICT', 'Slug và ngôn ngữ này đã tồn tại');
      throw error;
    }
  }

  async function updatePage(id, body, actor) {
    const input = validatePageWrite(body, { update: true });
    if (input.status === 'published') await assertPublishedPageContent(input);
    const values = { ...input };
    delete values.expectedVersion;
    try {
      const page = await transact(async (session) => {
        const previous = await Page.findById(id).session(session).lean();
        if (!previous) throw notFound();
        const updated = await replaceVersioned(Page, id, input.expectedVersion, values, session);
        await appendAudit(session, makeAudit(actor, 'content.page.update', 'page', id, {
          changesRedacted: { fromStatus: previous.status, toStatus: updated.status, locale: updated.locale },
        }));
        return updated;
      });
      return normalizeContentDocument(page);
    } catch (error) {
      if (duplicateKey(error)) throw conflict('VERSION_CONFLICT', 'Slug và ngôn ngữ này đã tồn tại');
      throw error;
    }
  }

  async function archivePage(id, expectedVersion, actor) {
    return transact(async (session) => {
      const updated = await archiveVersioned(Page, id, expectedVersion, session);
      await appendAudit(session, makeAudit(actor, 'content.page.archive', 'page', id, {
        changesRedacted: { toStatus: 'archived' },
      }));
      return normalizeContentDocument(updated);
    });
  }

  async function createNfcTag(body, actor) {
    const input = validateNfcTagCreate(body);
    const publicId = idGenerator();
    try {
      const tag = await transact(async (session) => {
        const story = await Story.findById(input.storyId).session(session).lean();
        if (!story || story.status !== 'published') throw conflict('INVALID_TRANSITION', 'NFC chỉ được gắn với câu chuyện đang công khai');
        if (input.productId) {
          const { missing } = await requireStoryProducts([input.productId], { publishedOnly: true, session });
          if (missing.length) throw conflict('INVALID_TRANSITION', 'NFC chỉ được gắn với sản phẩm đang công khai');
        }
        const [created] = await NfcTag.create([{
          ...input,
          publicId,
          status: 'active',
          createdBy: actor.id,
          version: 0,
        }], { session });
        await appendAudit(session, makeAudit(actor, 'content.nfc.create', 'nfc_tag', created._id, {
          changesRedacted: { status: 'active' },
        }));
        return created;
      });
      return {
        ...normalizeContentDocument(tag),
        publicUrl: `/nfc/${publicId}`,
      };
    } catch (error) {
      if (duplicateKey(error)) throw conflict('VERSION_CONFLICT', 'Không thể tạo mã NFC duy nhất; hãy thử lại');
      throw error;
    }
  }

  async function revokeNfcTag(id, body, actor) {
    const { expectedVersion } = validateReasonVersion(body);
    return transact(async (session) => {
      const previous = await NfcTag.findById(id).session(session).lean();
      if (!previous) throw notFound();
      if (previous.status === 'revoked') throw conflict('INVALID_TRANSITION', 'Mã NFC đã bị thu hồi');
      const updated = await replaceVersioned(NfcTag, id, expectedVersion, { status: 'revoked' }, session);
      await appendAudit(session, makeAudit(actor, 'content.nfc.revoke', 'nfc_tag', id, {
        reasonCode: 'ADMIN_REASON_PROVIDED',
        changesRedacted: { fromStatus: previous.status, toStatus: 'revoked' },
      }));
      return normalizeContentDocument(updated);
    });
  }

  async function getPublishedStory(slug, locale = 'vi') {
    const story = await Story.findOne({ slug, locale, status: 'published' }).lean();
    if (!story) throw notFound();
    return normalizeContentDocument(story);
  }

  async function getPublishedStoryById(storyId, { session } = {}) {
    const story = await Story.findById(storyId).session(session).lean();
    if (!story || story.status !== 'published') throw notFound();
    return normalizeContentDocument(story);
  }

  async function getPublishedPage(slug, locale = 'vi') {
    const page = await Page.findOne({ slug, locale, status: 'published' }).lean();
    if (!page) throw notFound();
    return normalizeContentDocument(page);
  }

  async function resolveNfc(publicId, locale = 'vi') {
    const tag = await NfcTag.findOne({ publicId }).lean();
    if (!tag) throw notFound();
    if (tag.status === 'revoked') {
      const error = conflict('NFC_REVOKED', 'Thẻ NFC này không còn hoạt động');
      error.status = 410;
      throw error;
    }
    const sourceStory = await Story.findById(tag.storyId).lean();
    if (!sourceStory) throw notFound();
    const story = await getPublishedStory(sourceStory.slug, locale);
    const productId = tag.productId ?? story.productIds?.[0];
    let product;
    if (productId) {
      const products = await productPort.getPublishedProductsByIds([idOf(productId)], { session: undefined });
      product = (products || []).find((item) => idOf(item) === idOf(productId));
    }
    return { ...(product ? { product: plain(product) } : {}), story };
  }

  async function listAdminStories(query) { return paginate(Story, query, query); }
  async function listAdminPages(query) { return paginate(Page, query, query); }

  async function listAdminNfcTags() {
    const tags = await NfcTag.find({}).sort({ createdAt: -1, _id: 1 }).limit(500).lean();
    return tags.map(normalizeContentDocument);
  }

  return Object.freeze({
    createStory, updateStory, archiveStory, listAdminStories,
    createPage, updatePage, archivePage, listAdminPages,
    createNfcTag, revokeNfcTag, listAdminNfcTags,
    getPublishedStory, getPublishedStoryById, getPublishedPage, resolveNfc,
  });
}
