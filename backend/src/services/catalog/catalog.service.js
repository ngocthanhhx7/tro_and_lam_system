import mongoose from 'mongoose';
import { badRequest, conflict, forbidden, notFound, unavailable } from '../../utils/serviceError.js';
import {
  PRODUCT_WRITE_FIELDS,
  validateAdminProductQuery,
  validateCategoryWrite,
  validateExpectedVersion,
  validateProductQuery,
  validateProductWrite,
} from './catalog-validation.js';

const PUBLIC_PRODUCT_FIELDS = Object.freeze([
  'id', 'slug', 'name', 'line', 'categoryId', 'description', 'material', 'dimensions',
  'careInstructions', 'images', 'saleMode', 'priceVnd', 'storyId', 'featured', 'availableForPurchase', 'stockLabel',
]);

function plainId(value) {
  return String(value?._id ?? value?.id ?? value ?? '');
}

function asCategoryId(value) {
  return plainId(value?.categoryId ?? value);
}

function productBase(product) {
  const data = {};
  for (const field of PRODUCT_WRITE_FIELDS) {
    if (product[field] !== undefined) data[field] = product[field];
  }
  data.categoryId = asCategoryId(product);
  data.images = (product.images || []).map((image) => ({
    url: image.url,
    alt: image.alt,
    sortOrder: image.sortOrder,
  }));
  if (product.storyId) data.storyId = plainId(product.storyId);
  else delete data.storyId;
  return data;
}

function toAdminProduct(product) {
  return {
    id: plainId(product),
    ...productBase(product),
    version: product.version ?? 0,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function toCategory(category) {
  return {
    id: plainId(category),
    slug: category.slug,
    name: category.name,
    description: category.description,
    parentId: category.parentId ? plainId(category.parentId) : undefined,
    sortOrder: category.sortOrder ?? 0,
    status: category.status,
    version: category.version ?? 0,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

function toPublicProduct(product, availability) {
  const categoryId = asCategoryId(product);
  const quoteOnly = product.saleMode === 'quote';
  const available = !quoteOnly && availability.status === 'known' && availability.available;
  const data = {
    id: plainId(product),
    slug: product.slug,
    name: product.name,
    line: product.line,
    categoryId,
    description: product.description || '',
    material: product.material || '',
    images: [...(product.images || [])].sort((a, b) => a.sortOrder - b.sortOrder).map((image) => ({
      url: image.url,
      alt: image.alt,
      sortOrder: image.sortOrder,
    })),
    saleMode: product.saleMode,
    featured: Boolean(product.featured),
    availableForPurchase: available,
    stockLabel: quoteOnly
      ? 'Yêu cầu tư vấn'
      : availability.status === 'unknown'
      ? 'Đang xác minh khả năng cung ứng'
      : available ? 'Có thể đặt mua' : 'Tạm thời chưa có hàng',
  };
  if (product.dimensions) data.dimensions = product.dimensions;
  if (product.careInstructions) data.careInstructions = product.careInstructions;
  if (Number.isSafeInteger(product.priceVnd) && product.priceVnd > 0 && product.saleMode !== 'quote') data.priceVnd = product.priceVnd;
  return Object.fromEntries(Object.entries(data).filter(([field, value]) => PUBLIC_PRODUCT_FIELDS.includes(field) && value !== undefined));
}

function toCheckoutProduct(product) {
  return {
    productId: plainId(product),
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    line: product.line,
    saleMode: product.saleMode,
    priceVnd: product.priceVnd,
    imageUrl: product.images?.[0]?.url,
    version: product.version ?? 0,
  };
}

function pagination(page, limit, total) {
  return { page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0 };
}

function safePage(items, total, filters) {
  return { items, pagination: pagination(filters.page, filters.limit, total) };
}

function toAvailabilityMap(response) {
  const records = response instanceof Map
    ? [...response.entries()].map(([productId, value]) => typeof value === 'boolean' ? { productId, available: value } : { productId, ...value })
    : Array.isArray(response) ? response : Array.isArray(response?.items) ? response.items : [];
  return new Map(records.map((entry) => [plainId(entry.productId ?? entry.id ?? entry), entry.available === true]));
}

function duplicateConflict(error, entity) {
  if (error?.code !== 11000) return error;
  const field = error.keyPattern?.sku ? 'sku' : error.keyPattern?.slug ? 'slug' : 'catalog';
  return conflict('VERSION_CONFLICT', `${entity} có ${field} đã được sử dụng`);
}

function isAdminRole(actor) {
  return actor?.role === 'admin' && actor?.status !== 'blocked';
}

export function createCatalogService({
  productRepository,
  inventoryPort,
  storyPort,
  categoryRepository = productRepository,
  mediaProvider,
  actorIdOf = (actor) => actor?.id ?? actor?._id,
}) {
  if (!productRepository) throw new TypeError('Thiếu catalog repository');

  async function availabilityFor(products, { session, required = false } = {}) {
    const quoteOnly = products.filter((product) => product.saleMode === 'quote');
    const buyable = products.filter((product) => product.saleMode !== 'quote');
    const ids = buyable.map(plainId);
    const quoteStates = new Map(quoteOnly.map((product) => [plainId(product), { status: 'quote', available: false }]));
    if (!ids.length) return quoteStates;
    if (!inventoryPort || typeof inventoryPort.getAvailability !== 'function') {
      if (required) throw unavailable('DATABASE_UNAVAILABLE', 'Tình trạng tồn kho chưa sẵn sàng để lọc danh mục');
      return new Map([...quoteStates, ...ids.map((id) => [id, { status: 'unknown', available: false }])]);
    }
    try {
      const found = toAvailabilityMap(await inventoryPort.getAvailability(ids, { session }));
      return new Map([...quoteStates, ...ids.map((id) => [id, found.has(id)
        ? { status: 'known', available: found.get(id) }
        : { status: 'unknown', available: false }])]);
    } catch {
      if (required) throw unavailable('DATABASE_UNAVAILABLE', 'Không thể xác minh tình trạng tồn kho');
      return new Map([...quoteStates, ...ids.map((id) => [id, { status: 'unknown', available: false }])]);
    }
  }

  async function readPublishedPage(filters, { session } = {}) {
    if (filters.available === undefined) {
      const page = await productRepository.listPublishedProductPage(filters, { session });
      const states = await availabilityFor(page.items, { session });
      return safePage(page.items.map((product) => toPublicProduct(product, states.get(plainId(product)))), page.total, filters);
    }

    if (typeof productRepository.streamPublishedProducts !== 'function') {
      throw unavailable('DATABASE_UNAVAILABLE', 'Không thể lọc danh mục theo tình trạng tồn kho');
    }
    const pageStart = (filters.page - 1) * filters.limit;
    const pageEnd = pageStart + filters.limit;
    let total = 0;
    const matching = [];
    let batch = [];
    async function consumeBatch() {
      if (!batch.length) return;
      const current = batch;
      batch = [];
      const states = await availabilityFor(current, { session, required: true });
      for (const product of current) {
        const state = states.get(plainId(product));
        if (state?.status !== 'known' || state.available !== filters.available) continue;
        if (total >= pageStart && total < pageEnd) matching.push(toPublicProduct(product, state));
        total += 1;
      }
    }
    for await (const product of productRepository.streamPublishedProducts(filters, { session })) {
      batch.push(product);
      if (batch.length >= 100) await consumeBatch();
    }
    await consumeBatch();
    return safePage(matching, total, filters);
  }

  function resolveCategoryId(categoryValue, { session } = {}) {
    if (!categoryValue) return Promise.resolve(undefined);
    return categoryRepository.resolvePublishedCategory(categoryValue, { session }).then((category) => category?._id || null);
  }

  async function ensureProductCategory(data, { session, requirePublished = false } = {}) {
    if (!mongoose.isValidObjectId(data.categoryId)) {
      throw badRequest('VALIDATION_ERROR', 'Chọn một danh mục hợp lệ', [{ field: 'categoryId', code: 'INVALID_ID', message: 'Danh mục không hợp lệ' }]);
    }
    const category = await categoryRepository.findCategoryById(data.categoryId, { session });
    if (!category || category.status === 'archived' || (requirePublished && category.status !== 'published')) {
      throw badRequest('VALIDATION_ERROR', 'Danh mục chưa sẵn sàng để xuất bản', [{ field: 'categoryId', code: 'CATEGORY_UNAVAILABLE', message: 'Chọn danh mục đang hoạt động' }]);
    }
    return category;
  }

  return Object.freeze({
    async listPublishedProducts(query, { session } = {}) {
      const filters = validateProductQuery(query);
      if (filters.available !== undefined && filters.saleMode === 'quote') {
        return safePage([], 0, filters);
      }
      if (filters.category) {
        filters.categoryId = await resolveCategoryId(filters.category, { session });
        if (!filters.categoryId) return safePage([], 0, filters);
      }
      return readPublishedPage(filters, { session });
    },

    async searchPublished(query = {}, { session } = {}) {
      const filters = validateProductQuery({ ...query, page: query.page ?? 1, limit: query.limit ?? 20 });
      if (filters.available !== undefined && filters.saleMode === 'quote') {
        return safePage([], 0, filters);
      }
      if (filters.category) {
        filters.categoryId = await resolveCategoryId(filters.category, { session });
        if (!filters.categoryId) return safePage([], 0, filters);
      }
      return readPublishedPage(filters, { session });
    },

    async listPublishedCategories({ session } = {}) {
      return (await categoryRepository.listPublishedCategories({ session })).map(toCategory);
    },

    async getPublishedProductBySlug(slug, { session } = {}) {
      if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug) || slug.length > 180) throw notFound();
      const product = await productRepository.findPublishedProductBySlug(slug, { session });
      if (!product) throw notFound();
      const category = await productRepository.getPublishedCategoryForProduct(product.categoryId, { session });
      if (!category) throw notFound();
      const states = await availabilityFor([product], { session });
      const detail = { ...toPublicProduct(product, states.get(plainId(product))), sku: product.sku };
      if (product.storyId && storyPort?.getPublishedStoryById) {
        try {
          detail.story = await storyPort.getPublishedStoryById(plainId(product.storyId), { session });
        } catch (error) {
          if (error?.status !== 404) throw error;
        }
      }
      const related = await readPublishedPage({
        line: product.line,
        sort: 'newest',
        page: 1,
        limit: 5,
        q: '',
      }, { session });
      detail.relatedProducts = (related.items || []).filter((item) => item.id !== detail.id).slice(0, 4);
      return detail;
    },

    async getCheckoutProducts(ids, { session } = {}) {
      if (!Array.isArray(ids)) throw badRequest('BAD_REQUEST', 'Sản phẩm không hợp lệ');
      const products = await productRepository.findPublishedProductsByIds(ids, { session });
      return products.filter((product) => ['buy', 'both'].includes(product.saleMode)
        && Number.isSafeInteger(product.priceVnd) && product.priceVnd > 0).map(toCheckoutProduct);
    },

    async getPublishedProductsByIds(ids, { session } = {}) {
      if (!Array.isArray(ids)) throw badRequest('BAD_REQUEST', 'Danh sách sản phẩm không hợp lệ');
      const products = await productRepository.findPublishedProductsByIds(ids, { session });
      const categories = await productRepository.getPublishedCategoryIds(products.map((product) => product.categoryId), { session });
      const allowed = new Set(categories.map(plainId));
      const visible = products.filter((product) => allowed.has(asCategoryId(product)));
      const states = await availabilityFor(visible, { session });
      return visible.map((product) => toPublicProduct(product, states.get(plainId(product))));
    },

    async getAdminProductReferencesByIds(ids, { actor, session } = {}) {
      if (!isAdminRole(actor)) throw forbidden();
      if (!Array.isArray(ids)) throw badRequest('BAD_REQUEST', 'Danh sách sản phẩm không hợp lệ');
      const products = await productRepository.findProductsByIds(ids, { session });
      return products.map((product) => ({ ...toPublicProduct(product, { status: 'unknown', available: false }), status: product.status }));
    },

    async listAdminProducts(query, { session } = {}) {
      const filters = validateAdminProductQuery(query);
      const page = await productRepository.listAdminProducts(filters, { session });
      return safePage(page.items.map(toAdminProduct), page.total, filters);
    },

    async getAdminProduct(id, { session } = {}) {
      const product = await productRepository.findAdminProductById(id, { session });
      if (!product) throw notFound();
      return toAdminProduct(product);
    },

    async createProduct(input, { actor: _actor, session } = {}) {
      const data = validateProductWrite(input);
      await ensureProductCategory(data, { session, requirePublished: data.status === 'published' });
      try {
        const product = await productRepository.createProduct(data, { session });
        return toAdminProduct(product);
      } catch (error) { throw duplicateConflict(error, 'Sản phẩm'); }
    },

    async updateProduct(id, input, { actor: _actor, session } = {}) {
      const patch = validateProductWrite(input, { partial: true });
      const expectedVersion = validateExpectedVersion(input.expectedVersion);
      const current = await productRepository.findAdminProductById(id, { session });
      if (!current) throw notFound();
      if (current.version !== expectedVersion) throw conflict('VERSION_CONFLICT');
      const next = { ...productBase(current), ...patch };
      await validateProductWrite(next);
      await ensureProductCategory(next, { session, requirePublished: next.status === 'published' });
      const changes = Object.fromEntries(Object.entries(patch).filter(([key]) => key !== 'expectedVersion'));
      try {
        const product = await productRepository.updateProduct(id, changes, { session, expectedVersion });
        if (!product) throw conflict('VERSION_CONFLICT');
        return toAdminProduct(product);
      } catch (error) { throw duplicateConflict(error, 'Sản phẩm'); }
    },

    async archiveProduct(id, expectedVersionValue, { session } = {}) {
      const expectedVersion = validateExpectedVersion(expectedVersionValue);
      const product = await productRepository.findAdminProductById(id, { session });
      if (!product) throw notFound();
      if (product.version !== expectedVersion) throw conflict('VERSION_CONFLICT');
      const archived = await productRepository.archiveProduct(id, expectedVersion, { session });
      if (!archived) throw conflict('VERSION_CONFLICT');
      return null;
    },

    async listAdminCategories({ session } = {}) {
      return (await categoryRepository.listAdminCategories({ session })).map(toCategory);
    },

    async createCategory(input, { session } = {}) {
      const data = validateCategoryWrite(input);
      if (data.parentId && !await categoryRepository.findCategoryById(data.parentId, { session })) {
        throw badRequest('VALIDATION_ERROR', 'Danh mục cha không tồn tại', [{ field: 'parentId', code: 'NOT_FOUND', message: 'Chọn một danh mục hiện có' }]);
      }
      const createData = { ...data };
      delete createData.expectedVersion;
      try { return toCategory(await categoryRepository.createCategory(createData, { session })); }
      catch (error) { throw duplicateConflict(error, 'Danh mục'); }
    },

    async updateCategory(id, input, { session } = {}) {
      const patch = validateCategoryWrite(input, { partial: true });
      const expectedVersion = validateExpectedVersion(patch.expectedVersion);
      const current = await categoryRepository.findCategoryById(id, { session });
      if (!current) throw notFound();
      if (current.version !== expectedVersion) throw conflict('VERSION_CONFLICT');
      const next = { ...current, ...patch };
      if (next.parentId) {
        if (String(next.parentId) === String(id)) throw badRequest('VALIDATION_ERROR', 'Danh mục không thể là cha của chính nó');
        let parent = await categoryRepository.findCategoryById(next.parentId, { session });
        if (!parent) throw badRequest('VALIDATION_ERROR', 'Danh mục cha không tồn tại');
        const visited = new Set([String(id)]);
        while (parent) {
          const parentId = plainId(parent);
          if (visited.has(parentId)) throw badRequest('VALIDATION_ERROR', 'Danh mục cha không thể tạo vòng');
          visited.add(parentId);
          parent = parent.parentId ? await categoryRepository.findCategoryById(parent.parentId, { session }) : null;
        }
      }
      const changes = Object.fromEntries(Object.entries(patch).filter(([key]) => key !== 'expectedVersion'));
      try {
        const category = await categoryRepository.updateCategory(id, changes, { session, expectedVersion });
        if (!category) throw conflict('VERSION_CONFLICT');
        return toCategory(category);
      } catch (error) { throw duplicateConflict(error, 'Danh mục'); }
    },

    async archiveCategory(id, expectedVersionValue, { session } = {}) {
      const expectedVersion = validateExpectedVersion(expectedVersionValue);
      const category = await categoryRepository.findCategoryById(id, { session });
      if (!category) throw notFound();
      if (category.version !== expectedVersion) throw conflict('VERSION_CONFLICT');
      if (await categoryRepository.hasProductsInCategory(id, { session })) {
        throw conflict('VERSION_CONFLICT', 'Chuyển sản phẩm sang danh mục khác trước khi lưu trữ danh mục này');
      }
      const archived = await categoryRepository.archiveCategory(id, expectedVersion, { session });
      if (!archived) throw conflict('VERSION_CONFLICT');
    },

    async createMediaAsset({ file, alt }, { actor, session } = {}) {
      if (!mediaProvider || typeof mediaProvider.upload !== 'function' || mediaProvider.configured !== true) {
        throw unavailable('MEDIA_UNAVAILABLE', 'Kho lưu trữ ảnh chưa được cấu hình. Ảnh đang ở trạng thái bản nháp và chưa được tải lên.');
      }
      if (!file?.buffer || !file.mimeType || !Number.isSafeInteger(file.bytes)) {
        throw badRequest('UNSUPPORTED_MEDIA_TYPE', 'Tệp ảnh không hợp lệ');
      }
      let stored;
      try {
        stored = await mediaProvider.upload({ ...file, alt, actorId: actorIdOf(actor) });
        if (!stored?.storageKey || !stored?.publicUrl) throw new Error('Media adapter did not return a storage reference');
        const asset = await productRepository.createMediaAsset({
          storageKey: stored.storageKey,
          publicUrl: stored.publicUrl,
          mimeType: file.mimeType,
          bytes: file.bytes,
          alt,
          createdBy: actorIdOf(actor),
          status: 'ready',
        }, { session });
        return { id: plainId(asset), url: asset.publicUrl, alt: asset.alt, status: 'ready' };
      } catch (error) {
        if (stored?.storageKey && typeof mediaProvider.remove === 'function') {
          await mediaProvider.remove(stored.storageKey).catch(() => {});
        }
        if (error?.status) throw error;
        throw unavailable('MEDIA_UNAVAILABLE', 'Không thể lưu ảnh lâu dài. Bản nháp chưa được tải lên.');
      }
    },
  });
}

export { toAdminProduct, toPublicProduct, toCheckoutProduct, toAvailabilityMap };
