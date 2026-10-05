import mongoose from 'mongoose';
import { CatalogCategory } from '../../models/catalog/category.model.js';
import { CatalogProduct } from '../../models/catalog/product.model.js';
import { CatalogMediaAsset } from '../../models/catalog/media-asset.model.js';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function idText(value) {
  return String(value?._id ?? value?.id ?? value);
}

function queryText(filters) {
  const query = { status: 'published' };
  if (filters.line) query.line = filters.line;
  const priceFiltered = filters.priceMin !== undefined || filters.priceMax !== undefined;
  if (filters.saleMode && (filters.buyableOnly || priceFiltered)) {
    query.saleMode = { $eq: filters.saleMode, $in: ['buy', 'both'] };
  } else if (filters.saleMode) query.saleMode = filters.saleMode;
  else if (filters.buyableOnly || priceFiltered) query.saleMode = { $in: ['buy', 'both'] };
  if (filters.categoryId) query.categoryId = filters.categoryId;
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    query.priceVnd = {};
    if (filters.priceMin !== undefined) query.priceVnd.$gte = filters.priceMin;
    if (filters.priceMax !== undefined) query.priceVnd.$lte = filters.priceMax;
  }
  if (filters.q) {
    const expression = new RegExp(escapeRegExp(filters.q), 'i');
    query.$or = [{ name: expression }, { description: expression }, { sku: expression }];
  }
  return query;
}

async function publishedCategoryIds(Category, session) {
  let query = Category.distinct('_id', { status: 'published' });
  query = withSession(query, session);
  return query;
}

function sortFor(sort) {
  if (sort === 'name') return { name: 1, _id: 1 };
  if (sort === 'price_asc') return { priceVnd: 1, _id: 1 };
  if (sort === 'price_desc') return { priceVnd: -1, _id: 1 };
  return { createdAt: -1, _id: -1 };
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

function isDuplicateKey(error) {
  return error?.code === 11000;
}

export function createMongooseCatalogRepository({
  Product = CatalogProduct,
  Category = CatalogCategory,
  MediaAsset = CatalogMediaAsset,
} = {}) {
  return {
    async resolvePublishedCategory(value, { session } = {}) {
      const categoryQuery = mongoose.isValidObjectId(value)
        ? { _id: value, status: 'published' }
        : { slug: value, status: 'published' };
      const result = await withSession(Category.findOne(categoryQuery), session).select('_id slug name sortOrder').lean();
      return result || null;
    },

    async listPublishedCategories({ session } = {}) {
      let query = Category.find({ status: 'published' }).sort({ sortOrder: 1, name: 1, _id: 1 }).lean();
      query = withSession(query, session);
      return query;
    },

    async getPublishedCategoryIds(ids, { session } = {}) {
      if (!ids.length) return [];
      let query = Category.distinct('_id', { _id: { $in: ids }, status: 'published' });
      query = withSession(query, session);
      return query;
    },

    async findPublishedProductBySlug(slug, { session } = {}) {
      let query = Product.findOne({ slug, status: 'published' }).lean();
      query = withSession(query, session);
      return query;
    },

    async getPublishedCategoryForProduct(categoryId, { session } = {}) {
      let query = Category.findOne({ _id: categoryId, status: 'published' }).select('_id slug name').lean();
      query = withSession(query, session);
      return query;
    },

    async findPublishedProductById(id, { session } = {}) {
      if (!mongoose.isValidObjectId(id)) return null;
      let query = Product.findOne({ _id: id, status: 'published' }).lean();
      query = withSession(query, session);
      return query;
    },

    async findAdminProductById(id, { session } = {}) {
      if (!mongoose.isValidObjectId(id)) return null;
      let query = Product.findById(id).lean();
      query = withSession(query, session);
      return query;
    },

    async listAdminProducts(filters, { session } = {}) {
      const conditions = {};
      if (filters.status) conditions.status = filters.status;
      if (filters.line) conditions.line = filters.line;
      if (filters.q) {
        const expression = new RegExp(escapeRegExp(filters.q), 'i');
        conditions.$or = [{ name: expression }, { sku: expression }, { slug: expression }];
      }
      let countQuery = Product.countDocuments(conditions);
      let listQuery = Product.find(conditions)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((filters.page - 1) * filters.limit)
        .limit(filters.limit)
        .lean();
      countQuery = withSession(countQuery, session);
      listQuery = withSession(listQuery, session);
      const [items, total] = await Promise.all([listQuery, countQuery]);
      return { items, total };
    },

    async listPublishedProductPage(filters, { session } = {}) {
      const categoryIds = await publishedCategoryIds(Category, session);
      if (!categoryIds.length) return { items: [], total: 0 };
      const conditions = { ...queryText(filters), categoryId: { $in: categoryIds } };
      if (filters.categoryId) conditions.categoryId = filters.categoryId;
      const countQuery = withSession(Product.countDocuments(conditions), session);
      const listQuery = withSession(Product.find(conditions)
        .sort(sortFor(filters.sort))
        .skip((filters.page - 1) * filters.limit)
        .limit(filters.limit)
        .lean(), session);
      const [items, total] = await Promise.all([listQuery, countQuery]);
      return { items, total };
    },

    async *streamPublishedProducts(filters, { session } = {}) {
      const categoryIds = await publishedCategoryIds(Category, session);
      if (!categoryIds.length) return;
      const conditions = { ...queryText(filters), categoryId: filters.categoryId || { $in: categoryIds } };
      const query = withSession(Product.find(conditions).sort(sortFor(filters.sort)).lean(), session);
      const cursor = query.cursor({ batchSize: 100 });
      try {
        for await (const product of cursor) yield product;
      } finally {
        await cursor.close().catch(() => {});
      }
    },

    async findPublishedProductsByIds(ids, { session } = {}) {
      const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
      if (!validIds.length) return [];
      const categoryIds = await publishedCategoryIds(Category, session);
      let query = Product.find({ _id: { $in: validIds }, status: 'published', categoryId: { $in: categoryIds } }).lean();
      query = withSession(query, session);
      return query;
    },

    async findProductsByIds(ids, { session } = {}) {
      const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
      if (!validIds.length) return [];
      let query = Product.find({ _id: { $in: validIds } }).lean();
      query = withSession(query, session);
      return query;
    },

    async createProduct(data, { session } = {}) {
      const [product] = await Product.create([data], session ? { session } : undefined);
      return product.toObject();
    },

    async updateProduct(id, changes, { session, expectedVersion } = {}) {
      let currentVersion = expectedVersion;
      if (currentVersion === undefined) {
        let currentQuery = Product.findById(id).select('version').lean();
        currentQuery = withSession(currentQuery, session);
        const current = await currentQuery;
        if (!current) return null;
        currentVersion = current.version;
      }
      let query = Product.findOneAndUpdate(
        { _id: id, version: currentVersion },
        { $set: changes, $inc: { version: 1 } },
        { new: true, runValidators: true, session },
      ).lean();
      query = withSession(query, session);
      return query;
    },

    async archiveProduct(id, expectedVersion, { session } = {}) {
      let query = Product.findOneAndUpdate(
        { _id: id, version: expectedVersion },
        { $set: { status: 'archived' }, $inc: { version: 1 } },
        { new: true, session },
      ).lean();
      query = withSession(query, session);
      return query;
    },

    async listAdminCategories({ session } = {}) {
      let query = Category.find({}).sort({ sortOrder: 1, name: 1, _id: 1 }).lean();
      query = withSession(query, session);
      return query;
    },

    async createCategory(data, { session } = {}) {
      const [category] = await Category.create([data], session ? { session } : undefined);
      return category.toObject();
    },

    async findCategoryById(id, { session } = {}) {
      if (!mongoose.isValidObjectId(id)) return null;
      let query = Category.findById(id).lean();
      query = withSession(query, session);
      return query;
    },

    async findCategoryBySlug(slug, { session } = {}) {
      let query = Category.findOne({ slug }).lean();
      query = withSession(query, session);
      return query;
    },

    async updateCategory(id, changes, { session, expectedVersion } = {}) {
      let query = Category.findOneAndUpdate(
        { _id: id, version: expectedVersion },
        { $set: changes, $inc: { version: 1 } },
        { new: true, runValidators: true, session },
      ).lean();
      query = withSession(query, session);
      return query;
    },

    async archiveCategory(id, expectedVersion, { session } = {}) {
      let query = Category.findOneAndUpdate(
        { _id: id, version: expectedVersion },
        { $set: { status: 'archived' }, $inc: { version: 1 } },
        { new: true, session },
      ).lean();
      query = withSession(query, session);
      return query;
    },

    async hasProductsInCategory(categoryId, { session } = {}) {
      let query = Product.exists({ categoryId, status: 'published' });
      query = withSession(query, session);
      return Boolean(await query);
    },

    async createMediaAsset(data, { session } = {}) {
      const [asset] = await MediaAsset.create([data], session ? { session } : undefined);
      return asset.toObject();
    },

    async deleteMediaAssetByStorageKey(storageKey, { session } = {}) {
      let query = MediaAsset.deleteOne({ storageKey });
      query = withSession(query, session);
      return query;
    },

    isDuplicateKey,
    idText,
  };
}
