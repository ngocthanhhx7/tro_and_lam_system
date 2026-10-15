import express from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { createIdentityMiddleware } from '../middlewares/identity/identity.middleware.js';
import { appendSetCookie, cookieValue, serializeCookie } from '../services/identity/identity.security.js';
import { createGeminiProvider } from '../services/integrations/gemini/gemini.adapter.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { createAssistantRepository } from './assistant.repository.js';
import { AiConversation } from './assistant.models.js';
import { createAssistantService } from './assistant.service.js';
import { validateAssistantMessage } from './assistant.validators.js';
import { createAssistantDailyUsage } from './assistant.usage.js';

const GUEST_COOKIE_NAME = 'tl_assistant_guest';
const GUEST_TOKEN = /^[A-Za-z0-9_-]{43}$/u;

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
}

function optionalPrincipal(identity) {
  return (req, res, next) => {
    const sessionToken = cookieValue(req, identity.settings.sessionCookieName);
    if (sessionToken) return identity.requireActor(req, res, next);
    return next();
  };
}

function issueGuestCookie(req, res, { identity, config }) {
  const cookieName = config.assistantGuestCookieName || GUEST_COOKIE_NAME;
  let token = cookieValue(req, cookieName);
  if (!token || !GUEST_TOKEN.test(token)) {
    token = randomBytes(32).toString('base64url');
    const apiPath = identity.settings.cookiePath || '/api/v1';
    const path = config.assistantGuestCookiePath || `${apiPath.replace(/\/$/u, '')}/assistant`;
    const maxAge = 365 * 24 * 60 * 60;
    appendSetCookie(res, serializeCookie(cookieName, token, {
      httpOnly: true,
      secure: identity.settings.secureCookies,
      sameSite: identity.settings.sameSite,
      path,
      maxAge,
    }));
  }
  return createHash('sha256').update(token).digest('hex');
}

export function assistantGuestOwnerFromRequest(req, { cookieName = GUEST_COOKIE_NAME } = {}) {
  const token = cookieValue(req, cookieName);
  if (!token || !GUEST_TOKEN.test(token)) return null;
  return Object.freeze({ kind: 'guest', role: 'guest', assistantGuestHash: createHash('sha256').update(token).digest('hex') });
}

export function createAssistantRouter({ ports = {}, config = {} } = {}) {
  const identity = ports.identityMiddleware || createIdentityMiddleware({ ports, config });
  if (typeof identity.csrfProtection !== 'function' || typeof identity.requireActor !== 'function') {
    throw new TypeError('P10 router requires P02 CSRF and optional session authentication');
  }
  const assistantRepository = ports.assistantRepository || createAssistantRepository({ Conversation: ports.models?.AiConversation || AiConversation });
  const dailyUsage = ports.assistantDailyUsage || createAssistantDailyUsage();
  const provider = Object.hasOwn(ports, 'aiProvider')
    ? ports.aiProvider
    : createGeminiProvider({
      apiKey: config.geminiApiKey,
      model: config.geminiModel,
      timeoutMs: config.aiTimeoutMs,
      fetchImpl: ports.fetchImpl,
    });
  const service = ports.assistantService || createAssistantService({
    assistantRepository,
    productPort: ports.catalogPort,
    contentPort: ports.publishedContentPort,
    aiProvider: provider,
    usageGuard: ports.assistantUsageGuard,
    dailyUsage,
    customerCarePort: ports.customerCarePort,
    now: ports.now,
    config,
  });
  const router = express.Router();

  router.get('/assistant/usage', asyncRoute(async (req, res) => {
    const deviceHash = issueGuestCookie(req, res, { identity, config });
    res.set('Cache-Control', 'no-store');
    return sendSuccess(res, await dailyUsage.get(deviceHash, ports.now?.() || new Date()));
  }));

  router.post('/assistant/messages', identity.csrfProtection, optionalPrincipal(identity), asyncRoute(async (req, res) => {
    const input = validateAssistantMessage(req.body);
    const deviceHash = issueGuestCookie(req, res, { identity, config });
    const actor = { ...(req.actor || {
      kind: 'guest',
      role: 'guest',
      assistantGuestHash: deviceHash,
    }), assistantDeviceHash: deviceHash };
    res.set('Cache-Control', 'no-store');
    return sendSuccess(res, await service.sendMessage({ actor, input }));
  }));

  router.assistantService = service;
  return router;
}

export function createAssistantRouteFragment(dependencies) {
  return { prefix: '', router: createAssistantRouter(dependencies) };
}
