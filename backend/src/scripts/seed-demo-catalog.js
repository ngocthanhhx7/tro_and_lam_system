import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { CatalogCategory } from '../models/catalog/category.model.js';
import { CatalogProduct } from '../models/catalog/product.model.js';

const DEMO_DATABASE = 'tro_lam_dev_catalog_demo';
const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const PUBLIC_ROOT = resolve(REPOSITORY_ROOT, 'fondend/public');

export function assertDemoCatalogMongoUri(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Set DEMO_CATALOG_MONGODB_URI to the dedicated local demo database URI.');
  }

  const uri = value.trim();
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('DEMO_CATALOG_MONGODB_URI is not a valid MongoDB URI.');
  }

  if (parsed.protocol !== 'mongodb:'
    || !new Set(['127.0.0.1', 'localhost', '[::1]']).has(parsed.hostname)
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || decodeURIComponent(parsed.pathname.replace(/^\/+/, '')) !== DEMO_DATABASE) {
    throw new Error(`Refusing catalog demo seed: use an unauthenticated loopback URI for ${DEMO_DATABASE} without query options.`);
  }

  return Object.freeze({ uri, databaseName: DEMO_DATABASE });
}

const PRODUCT_COPY = Object.freeze({
  'lu-xong-tram-mini': Object.freeze({ sku: 'DEMO-LIF-001', name: 'Lư xông trầm mini', line: 'lifestyle' }),
  'hu-tra': Object.freeze({ sku: 'DEMO-LIF-002', name: 'Hũ trà', line: 'lifestyle' }),
  'bo-chen-doc-am': Object.freeze({ sku: 'DEMO-LIF-003', name: 'Bộ chén độc ẩm', line: 'lifestyle' }),
  'binh-thien-nga': Object.freeze({ sku: 'DEMO-DIP-001', name: 'Bình Thiên Nga', line: 'diplomacy' }),
  'binh-phu-quy': Object.freeze({ sku: 'DEMO-DIP-002', name: 'Bình Phú Quý', line: 'diplomacy' }),
  'binh-giot-ngoc': Object.freeze({ sku: 'DEMO-DIP-003', name: 'Bình Giọt Ngọc', line: 'diplomacy' }),
  'binh-hoa-lam': Object.freeze({ sku: 'DEMO-DIP-004', name: 'Bình Hoa Lam', line: 'diplomacy' }),
  'binh-ty-ba': Object.freeze({ sku: 'DEMO-DIP-005', name: 'Bình Tỳ Bà', line: 'diplomacy' }),
});

const CATEGORY_DATA = Object.freeze({
  lifestyle: Object.freeze({
    slug: 'demo-lifestyle',
    name: 'Lifestyle · dữ liệu xem trước',
    description: 'Danh mục demo local để xem giao diện. Tên và khả năng cung cấp cần chủ dự án xác nhận.',
    sortOrder: 900,
  }),
  diplomacy: Object.freeze({
    slug: 'demo-diplomacy',
    name: 'Diplomacy · dữ liệu xem trước',
    description: 'Danh mục demo local để xem giao diện. Tên và khả năng cung cấp cần chủ dự án xác nhận.',
    sortOrder: 901,
  }),
});

function resolveDemoAsset(url) {
  const allowedPrefixes = [
    '/assets/products/concepts/',
    '/assets/products/generated/',
    '/assets/products/owner-provided/',
    '/assets/products/derived/',
  ];
  if (typeof url !== 'string' || !allowedPrefixes.some((prefix) => url.startsWith(prefix))) {
    throw new Error('Demo product image must use an approved same-site product asset URL.');
  }
  const path = resolve(PUBLIC_ROOT, url.replace(/^\/+/, ''));
  const relativePath = relative(PUBLIC_ROOT, path);
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath) || !existsSync(path)) {
    throw new Error(`Demo product image is missing or outside public assets: ${url}`);
  }
  return path;
}

export async function readConceptManifest() {
  const manifestPath = resolve(PUBLIC_ROOT, 'assets/products/concepts/manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.products) || manifest.products.length !== Object.keys(PRODUCT_COPY).length) {
    throw new Error('The product image manifest does not match the fixed demo catalog.');
  }

  for (const entry of manifest.products) {
    if (!Object.hasOwn(PRODUCT_COPY, entry.slug) || PRODUCT_COPY[entry.slug].line !== entry.line) {
      throw new Error(`Unexpected demo product in concept image manifest: ${entry.slug}`);
    }
    if (!Array.isArray(entry.images) || entry.images.length < 3) {
      throw new Error(`Demo product ${entry.slug} needs at least three concept images.`);
    }
    if (new Set(entry.images.map((image) => image.url)).size !== entry.images.length) {
      throw new Error(`Demo product ${entry.slug} must use three distinct gallery image files.`);
    }
    for (const image of entry.images) {
      resolveDemoAsset(image.url);
      const isConcept = image.url.startsWith('/assets/products/concepts/')
        || image.url.startsWith('/assets/products/generated/');
      const isDerived = image.url.startsWith('/assets/products/derived/');
      if (isConcept && !/concept AI/iu.test(image.alt)) {
        throw new Error(`Demo concept image needs an honest AI disclosure: ${entry.slug}`);
      }
      if (isDerived && (!/cắt từ ảnh/iu.test(image.alt) || !/chủ dự án cung cấp/iu.test(image.alt))) {
        throw new Error(`Demo derived image needs a source description: ${entry.slug}`);
      }
      if (!isConcept && !isDerived && !/chủ dự án cung cấp/iu.test(image.alt)) {
        throw new Error(`Demo owner-provided image needs a source description: ${entry.slug}`);
      }
    }
  }
  return manifest.products;
}

async function upsertCategory(data) {
  return CatalogCategory.findOneAndUpdate(
    { slug: data.slug },
    { $setOnInsert: { ...data, status: 'published', version: 0 } },
    { upsert: true, returnDocument: 'after', runValidators: true },
  ).exec();
}

export async function seedDemoCatalog(uri) {
  const { databaseName } = assertDemoCatalogMongoUri(uri);
  const manifestProducts = await readConceptManifest();

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, autoIndex: true });
  try {
    await Promise.all([CatalogCategory.init(), CatalogProduct.init()]);
    const [lifestyleCategory, diplomacyCategory] = await Promise.all([
      upsertCategory(CATEGORY_DATA.lifestyle),
      upsertCategory(CATEGORY_DATA.diplomacy),
    ]);
    if (lifestyleCategory.status !== 'published' || diplomacyCategory.status !== 'published') {
      throw new Error('A demo category already exists but is not published; refusing to change it.');
    }
    const categoryByLine = { lifestyle: lifestyleCategory, diplomacy: diplomacyCategory };
    const demoNotice = 'Mẫu xem trước chỉ dùng trên máy local. Giá, thông số, tồn kho và khả năng cung cấp chưa được xác nhận. Nguồn từng ảnh được ghi trong gallery.';

    for (const product of manifestProducts) {
      const copy = PRODUCT_COPY[product.slug];
      const category = categoryByLine[copy.line];
      const existing = await CatalogProduct.findOne({ slug: product.slug })
        .select({ sku: 1, line: 1, categoryId: 1 })
        .lean()
        .exec();
      if (existing && (existing.sku !== copy.sku
        || existing.line !== copy.line
        || String(existing.categoryId) !== String(category._id))) {
        throw new Error(`A non-demo product conflicts with preview slug ${product.slug}; refusing to change it.`);
      }
      await CatalogProduct.updateOne(
        { slug: product.slug, sku: copy.sku },
        {
          $set: {
            description: demoNotice,
            images: product.images,
          },
          $setOnInsert: {
            slug: product.slug,
            sku: copy.sku,
            name: copy.name,
            line: copy.line,
            categoryId: category._id,
            saleMode: 'quote',
            status: 'published',
            featured: true,
            version: 0,
          },
        },
        { upsert: true, runValidators: true },
      ).exec();
    }

    const products = await CatalogProduct.find({ sku: /^DEMO-(?:LIF|DIP)-/u })
      .select({ _id: 1, line: 1, status: 1, saleMode: 1, priceVnd: 1, images: 1 })
      .lean()
      .exec();
    const byLine = {
      lifestyle: products.filter((product) => product.line === 'lifestyle').length,
      diplomacy: products.filter((product) => product.line === 'diplomacy').length,
    };
    const result = {
      database: databaseName,
      demoProducts: products.length,
      byLine,
      quoteOnly: products.every((product) => product.saleMode === 'quote'),
      pricesUnset: products.every((product) => product.priceVnd === undefined),
      threeImagesEach: products.every((product) => product.images.length >= 3),
      publicLocalPreviewOnly: products.every((product) => product.status === 'published'),
    };
    if (result.demoProducts !== Object.keys(PRODUCT_COPY).length
      || byLine.lifestyle !== 3
      || byLine.diplomacy !== 5
      || !result.quoteOnly
      || !result.pricesUnset
      || !result.threeImagesEach
      || !result.publicLocalPreviewOnly) {
      throw new Error('Seed verification failed; inspect only the dedicated local demo database.');
    }
    return result;
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  const result = await seedDemoCatalog(process.env.DEMO_CATALOG_MONGODB_URI);
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
