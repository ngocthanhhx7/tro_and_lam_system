import { Router } from 'express';
import { sendCreated, sendNoContent, sendPaginated, sendSuccess } from '../utils/apiResponse.js';
import { Page, NfcTag, Story } from './content.models.js';
import {
  validateExpectedVersionQuery,
  validateDocumentId,
  validateListQuery,
  validateLocaleQuery,
  validatePublicId,
} from './content.validators.js';
import { createContentService } from './content.service.js';

function actorOf(req, res) {
  if (!req.actor?.id) throw new TypeError('Identity middleware must attach the active actor to req.actor');
  return { ...req.actor, requestId: res.locals.requestId };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
}

export function createContentRouter({
  requireCapability,
  csrfProtection,
  productPort,
  auditPort,
  models = { Story, Page, NfcTag },
  connection = models.Story?.db,
  idGenerator,
  service: suppliedService,
} = {}) {
  if (typeof requireCapability !== 'function' || typeof csrfProtection !== 'function') {
    throw new TypeError('P08 router requires P02 capability and CSRF middleware');
  }
  const admin = requireCapability('content.manage');
  if (typeof admin !== 'function') throw new TypeError('P02 content.manage middleware is invalid');
  const service = suppliedService || createContentService({ ...models, connection, productPort, auditPort, idGenerator });
  const router = Router();

  router.get('/stories/:slug', asyncRoute(async (req, res) => {
    const story = await service.getPublishedStory(req.params.slug, validateLocaleQuery(req.query.locale));
    return sendSuccess(res, story);
  }));
  router.get('/pages/:slug', asyncRoute(async (req, res) => {
    const page = await service.getPublishedPage(req.params.slug, validateLocaleQuery(req.query.locale));
    return sendSuccess(res, page);
  }));
  router.get('/nfc/:publicId', asyncRoute(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const result = await service.resolveNfc(validatePublicId(req.params.publicId), validateLocaleQuery(req.query.locale));
    return sendSuccess(res, result);
  }));

  router.use('/admin', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/admin/stories', admin, asyncRoute(async (req, res) => {
    const query = validateListQuery(req.query);
    const result = await service.listAdminStories(query);
    return sendPaginated(res, result.items, result.pagination);
  }));
  router.post('/admin/stories', admin, csrfProtection, asyncRoute(async (req, res) => {
    return sendCreated(res, await service.createStory(req.body, actorOf(req, res)));
  }));
  router.patch('/admin/stories/:id', admin, csrfProtection, asyncRoute(async (req, res) => {
    return sendSuccess(res, await service.updateStory(validateDocumentId(req.params.id), req.body, actorOf(req, res)));
  }));
  router.delete('/admin/stories/:id', admin, csrfProtection, asyncRoute(async (req, res) => {
    const expectedVersion = validateExpectedVersionQuery(req.query.expectedVersion);
    await service.archiveStory(validateDocumentId(req.params.id), expectedVersion, actorOf(req, res));
    return sendNoContent(res);
  }));

  router.get('/admin/pages', admin, asyncRoute(async (req, res) => {
    const query = validateListQuery(req.query);
    const result = await service.listAdminPages(query);
    return sendPaginated(res, result.items, result.pagination);
  }));
  router.post('/admin/pages', admin, csrfProtection, asyncRoute(async (req, res) => {
    return sendCreated(res, await service.createPage(req.body, actorOf(req, res)));
  }));
  router.patch('/admin/pages/:id', admin, csrfProtection, asyncRoute(async (req, res) => {
    return sendSuccess(res, await service.updatePage(validateDocumentId(req.params.id), req.body, actorOf(req, res)));
  }));
  router.delete('/admin/pages/:id', admin, csrfProtection, asyncRoute(async (req, res) => {
    const expectedVersion = validateExpectedVersionQuery(req.query.expectedVersion);
    await service.archivePage(validateDocumentId(req.params.id), expectedVersion, actorOf(req, res));
    return sendNoContent(res);
  }));

  router.get('/admin/nfc-tags', admin, asyncRoute(async (_req, res) => {
    return sendSuccess(res, await service.listAdminNfcTags());
  }));
  router.post('/admin/nfc-tags', admin, csrfProtection, asyncRoute(async (req, res) => {
    return sendCreated(res, await service.createNfcTag(req.body, actorOf(req, res)));
  }));
  router.post('/admin/nfc-tags/:id/revoke', admin, csrfProtection, asyncRoute(async (req, res) => {
    return sendSuccess(res, await service.revokeNfcTag(validateDocumentId(req.params.id), req.body, actorOf(req, res)));
  }));

  router.contentService = service;
  return router;
}

export function createContentRouteFragment(dependencies) {
  return { prefix: '', router: createContentRouter(dependencies) };
}
