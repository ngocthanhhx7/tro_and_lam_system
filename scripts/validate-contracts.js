import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contractDir = path.join(root, 'doc', 'contracts');
const openapiPath = path.join(contractDir, 'openapi.yaml');
const dtosPath = path.join(contractDir, 'schemas', 'dtos.schema.json');
const enumsPath = path.join(contractDir, 'schemas', 'enums.schema.json');
const manifestPath = path.join(contractDir, 'manifest.json');

const api = await SwaggerParser.validate(openapiPath);
assert.equal(api.openapi, '3.1.0', 'OpenAPI must stay on the frozen 3.1 contract');
const operationIds = new Set();
for (const [routePath, pathItem] of Object.entries(api.paths)) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method)) continue;
    assert.ok(operation.operationId, `${method.toUpperCase()} ${routePath} must have an operationId`);
    assert.ok(!operationIds.has(operation.operationId), `operationId ${operation.operationId} must be unique`);
    operationIds.add(operation.operationId);
    assert.ok(operation.responses && Object.keys(operation.responses).length > 0, `${operation.operationId} must declare responses`);
    if (!operation.tags?.includes('health')) {
      assert.ok(Array.isArray(operation['x-actors']) && operation['x-actors'].length > 0, `${operation.operationId} must declare actors`);
    }
  }
}
assert.ok(!JSON.stringify(api).includes('#/components/schemas/GenericObject'), 'request DTOs must not use untyped GenericObject schemas');

const [dtos, enums, planningEnums, manifest] = await Promise.all([
  readFile(dtosPath, 'utf8').then(JSON.parse),
  readFile(enumsPath, 'utf8').then(JSON.parse),
  readFile(path.join(root, 'doc', 'planning', 'contract-enums.json'), 'utf8').then(JSON.parse),
  readFile(manifestPath, 'utf8').then(JSON.parse),
]);

assert.match(manifest.baselineCommit, /^[0-9a-f]{40}$/i, 'Manifest must record a real full-length baseline commit');
assert.match(manifest.sourceCommit, /^[0-9a-f]{40}$/i, 'Manifest must record the source commit');
assert.equal(manifest.contractVersion, api.info.version, 'Manifest and OpenAPI contract versions must match');
assert.deepEqual(manifest.artifacts, [
  'doc/contracts/openapi.yaml',
  'doc/contracts/schemas/dtos.schema.json',
  'doc/contracts/schemas/enums.schema.json',
]);

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const dtoUri = pathToFileURL(dtosPath).href;
const enumUri = pathToFileURL(enumsPath).href;
ajv.addSchema(dtos, dtoUri);
ajv.addSchema(enums, enumUri);

for (const [name, schema] of Object.entries(enums.$defs)) {
  const planningName = name === 'role' ? 'roles' : name;
  if (Array.isArray(planningEnums[planningName])) {
    assert.deepEqual(schema.enum, planningEnums[planningName], `Planning enum ${planningName} must match JSON Schema`);
  }
  ajv.compile({ $ref: `${enumUri}#/$defs/${name}` });
}

const compiledDtos = new Map();
for (const name of Object.keys(dtos.$defs)) {
  compiledDtos.set(name, ajv.compile({ $ref: `${dtoUri}#/$defs/${name}` }));
}

const dtoFixtures = [
  ['userRegister', { name: 'Nguyễn An', email: 'an@example.com', password: 'passphrase-cho-test' }, true],
  ['userRegister', { name: 'Nguyễn An', email: 'an@example.com', password: 'passphrase-cho-test', role: 'admin' }, false],
  ['userInvite', { name: 'Nhân viên', email: 'staff@example.com', role: 'staff' }, true],
  ['userInvite', { name: 'Tài khoản', email: 'admin@example.com', role: 'admin' }, false],
  ['addressPatch', { expectedVersion: 2, label: 'Nhà riêng' }, true],
  ['addressPatch', { recipientName: 'An Nguyễn' }, false],
  ['orderTransition', { toStatus: 'shipped', expectedVersion: 3, reason: 'Bàn giao thủ công' }, true],
  ['orderTransition', { toStatus: 'shipped', expectedVersion: 3 }, false],
  ['orderTransition', { toStatus: 'shipped', expectedVersion: 3, shipping: { carrier: 'Đơn vị vận chuyển' } }, false],
  ['orderTransition', { toStatus: 'shipped', expectedVersion: 3, shipping: { carrier: 'Đơn vị vận chuyển', trackingNumber: 'TRACK-1' } }, true],
  ['orderTransition', { toStatus: 'shipped', expectedVersion: 3, reason: 'Bàn giao hãng', shipping: { carrier: 'Đơn vị vận chuyển', trackingNumber: 'TRACK-1' } }, true],
  ['orderTransition', { toStatus: 'cancelled', expectedVersion: 3, reason: 'Khách yêu cầu hủy' }, true],
  ['orderTransition', { toStatus: 'cancelled', expectedVersion: 3 }, false],
  ['orderTransition', { toStatus: 'processing', expectedVersion: 3 }, true],
  ['businessSettingsWrite', { values: { codEnabled: false }, expectedVersion: 2, reason: 'Cập nhật cài đặt' }, true],
  ['businessSettingsWrite', { values: { shippingZones: [{ id: 'mien-bac', provinceNames: ['Hà Nội', 'Hải Phòng'], feeVnd: 30000 }] }, expectedVersion: 2, reason: 'Cấu hình vùng giao hàng' }, true],
  ['businessSettingsWrite', { values: { shippingZones: [{ id: 'mien-bac', provinceNames: ['Hà Nội'], feeVnd: -1 }] }, expectedVersion: 2, reason: 'Cấu hình vùng giao hàng' }, false],
  ['businessSettingsWrite', { values: { shippingZones: [{ id: 'mien-bac', name: 'Miền Bắc', provinceNames: ['Hà Nội'], feeVnd: 30000 }] }, expectedVersion: 2, reason: 'Cấu hình vùng giao hàng' }, false],
  ['businessSettingsWrite', { values: { smtpPassword: 'fixture-only' }, expectedVersion: 2, reason: 'Cập nhật cài đặt' }, false],
  ['storyWrite', { slug: 'nfc-story-fixture', title: 'Câu chuyện thử nghiệm', locale: 'vi', origin: 'Nguồn chờ chủ dự án duyệt', motifs: [], sections: [{ heading: 'Mở đầu', body: [{ type: 'paragraph', text: 'Nội dung fixture kiểm thử.' }] }], media: [], productIds: [], status: 'published' }, true],
  ['storyWrite', { slug: 'nfc-story-fixture', title: 'Câu chuyện thử nghiệm', locale: 'vi', origin: '', motifs: [], sections: [{ body: [] }], media: [], productIds: [], status: 'published' }, false],
  ['storyWrite', { slug: 'nfc-story-fixture', title: 'Câu chuyện thử nghiệm', locale: 'vi', origin: 'Nguồn chờ chủ dự án duyệt', motifs: [], sections: [{ body: [{ type: 'paragraph', text: 'Nội dung.', onClick: 'fixture' }] }], media: [], productIds: [], status: 'draft' }, false],
  ['pageWrite', { slug: 'noi-dung-fixture', title: 'Trang thử nghiệm', locale: 'vi', blocks: [{ type: 'link', text: 'Câu chuyện', url: '/cau-chuyen' }], status: 'draft' }, true],
  ['pageWrite', { slug: 'noi-dung-fixture', title: 'Trang thử nghiệm', locale: 'vi', blocks: [{ type: 'link', text: 'Liên kết', url: 'javascript:alert(1)' }], status: 'draft' }, false],
  ['pageWrite', { slug: 'noi-dung-fixture', title: 'Trang thử nghiệm', locale: 'vi', blocks: [{ type: 'image', url: 'https://user:pass@example.com/anh.jpg', alt: 'Ảnh fixture' }], status: 'draft' }, false],
  ['pageWrite', { slug: 'noi-dung-fixture', title: 'Trang thử nghiệm', locale: 'vi', blocks: [], status: 'published' }, false],
];
for (const [name, value, expected] of dtoFixtures) {
  assert.equal(compiledDtos.get(name)(value), expected, `${name} fixture must be ${expected ? 'accepted' : 'rejected'}`);
}

assert.equal(manifest.validation.result.openapiVersion, api.openapi);
assert.equal(manifest.validation.result.paths, Object.keys(api.paths).length);
assert.equal(manifest.validation.result.operations, operationIds.size);
assert.equal(manifest.validation.result.dtoSchemas, Object.keys(dtos.$defs).length);
assert.equal(manifest.validation.result.enums, Object.keys(enums.$defs).length);
assert.equal(manifest.validation.result.dtoFixtures, dtoFixtures.length);

console.log(`Contracts valid: OpenAPI ${api.openapi}, ${Object.keys(api.paths).length} paths, ${operationIds.size} operations, ${Object.keys(dtos.$defs).length} DTO schemas, ${Object.keys(enums.$defs).length} frozen enums, ${dtoFixtures.length} DTO fixtures.`);
