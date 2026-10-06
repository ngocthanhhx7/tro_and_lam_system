import { createHash } from 'node:crypto';
import { cookieValue } from './services/identity/identity.security.js';
import { createIdentityRouter } from './routes/identity/identity.routes.js';
import { createAccountRouter } from './routes/account/account.routes.js';
import { createCatalogRouter } from './routes/catalog.routes.js';
import { createCommerceRouter } from './routes/commerce/commerce.routes.js';
import { createPaymentsRouter } from './routes/payments/payments.routes.js';
import { createOperationsRouter } from './routes/operations.routes.js';
import { createContentRouter } from './content/content.routes.js';
import { createSupportRouter } from './support/support.routes.js';
import { createAssistantRouter } from './assistant/assistant.routes.js';
import { createAssistantTranscriptPort } from './assistant/assistant.ports.js';
import { createPublishedContentPort } from './content/content.ports.js';
import { createAccountService } from './services/account/account.service.js';
import { createCatalogService } from './services/catalog/catalog.service.js';
import { createMongooseCatalogRepository } from './services/catalog/mongoose-catalog.repository.js';
import { createLocalMediaProvider, createUnavailableMediaProvider } from './services/catalog/media-provider.js';
import { createCommerceService } from './services/commerce/commerce.service.js';
import { createShippingZoneQuotePort } from './services/commerce/shipping-zones.js';
import { createPaymentsService } from './services/payments/payments.service.js';
import { createOperationsPorts, createOutboxPayloadCipher } from './services/operations/index.js';
import { createAuditService } from './services/operations/audit.service.js';
import { createBusinessSettingsService } from './services/operations/business-settings.service.js';
import { createDashboardService } from './services/operations/dashboard.service.js';
import { createFinanceLedgerPort } from './services/operations/finance-ledger.port.js';
import { createNotificationService } from './services/operations/notification.service.js';
import { createOutboxService } from './services/operations/outbox.service.js';
import { createOutboxWorker, startOutboxWorker } from './jobs/operations/outbox.worker.js';
import { createReleaseExpiredReservationsJob } from './jobs/commerce/release-expired-reservations.job.js';
import { createReconcilePendingAttemptsJob } from './jobs/payments/reconcile-pending-attempts.job.js';
import { createSmtpProvider } from './services/integrations/smtp/smtp.provider.js';
import { createNodemailerTransport } from './services/integrations/smtp/nodemailer.transport.js';
import { User } from './models/identity/user.model.js';
import { Order } from './models/commerce/order.model.js';
import { CodCollection } from './models/commerce/cod-collection.model.js';
import { PaymentEvent } from './models/payments/payment-event.model.js';
import { Refund } from './models/payments/refund.model.js';
import { BusinessSetting, AuditLog, Notification, OutboxEvent } from './models/operations/index.js';
import { Ticket, Contact } from './support/support.models.js';
import { unavailable } from './utils/serviceError.js';

const GUEST_CART_TOKEN = /^[A-Za-z0-9_-]{43}$/u;

function buildServerConfig(env) {
  return {
    ...env,
    allowedOrigins: env.origins,
    challengeSecret: env.challengeSecret || env.csrfSecret,
    assistantGuestCookieName: env.assistantGuestCookieName || 'tl_assistant_guest',
    guestCartCookieName: env.guestCartCookieName || 'tl_guest_cart',
    publicWebUrl: env.publicWebUrl,
    geminiApiKey: env.geminiApiKey,
    geminiModel: env.geminiModel,
    aiTimeoutMs: env.aiTimeoutMs,
    aiDailyBudget: env.aiDailyBudget,
    payosEnabled: env.payosEnabled,
    payosClientId: env.payosClientId,
    payosApiKey: env.payosApiKey,
    payosChecksumKey: env.payosChecksumKey,
    payosTimeoutMs: env.payosTimeoutMs,
    smtpTimeoutMs: env.smtpTimeoutMs,
    supportInbox: env.supportInboxEmail,
  };
}

function makeActorResolvers(identityMiddleware, identityService, config) {
  async function resolveActor(req) {
    const sessionToken = cookieValue(req, identityMiddleware.settings.sessionCookieName);
    if (sessionToken) return identityService.authenticateSession(sessionToken);

    const guestCartToken = cookieValue(req, config.guestCartCookieName);
    if (!guestCartToken || !GUEST_CART_TOKEN.test(guestCartToken)) return undefined;
    return {
      kind: 'guest',
      guestTokenHash: createHash('sha256').update(guestCartToken).digest('hex'),
    };
  }

  async function resolveOrderActor(req, orderId) {
    const sessionToken = cookieValue(req, identityMiddleware.settings.sessionCookieName);
    if (sessionToken) return identityService.authenticateSession(sessionToken);

    const proofToken = cookieValue(req, identityMiddleware.settings.guestOrderCookieName);
    if (!proofToken) return undefined;
    const proof = await identityService.authenticateGuestOrderProof(proofToken);
    if (String(proof.orderId) !== String(orderId)) return undefined;
    return {
      kind: 'guest',
      role: 'guest',
      orderId: proof.orderId,
      scopes: proof.scopes,
      guestOrderProof: proof,
    };
  }

  return Object.freeze({ resolveActor, resolveOrderActor });
}

function startPeriodicJob(job, { name, intervalMs, logger = console } = {}) {
  const run = typeof job === 'function' ? job : job?.run?.bind(job);
  if (typeof run !== 'function') throw new TypeError('Periodic job must be a function or expose run()');
  let stopped = false;
  let timer;
  let active;

  async function tick() {
    if (stopped) return;
    active = Promise.resolve().then(run);
    try {
      await active;
    } catch (error) {
      const candidate = typeof error?.code === 'string' ? error.code : '';
      const code = /^[A-Z][A-Z0-9_]{0,79}$/u.test(candidate) ? candidate : 'JOB_ERROR';
      logger.warn(`[${name}] ${code}`);
    } finally {
      active = null;
      if (!stopped) {
        timer = setTimeout(() => { void tick(); }, intervalMs);
        timer.unref?.();
      }
    }
  }

  void tick();
  return Object.freeze({
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (active) await active.catch(() => {});
    },
  });
}

/** Build real domain routers and supervised workers after env validation and Mongo connection. */
export async function createDomainComposition(env) {
  if (!env || typeof env !== 'object') throw new TypeError('Validated environment configuration is required');
  const config = buildServerConfig(env);
  const outboxCipher = createOutboxPayloadCipher({ key: env.outboxEncryptionKey });
  const operationsPorts = createOperationsPorts({ encryptMailPayload: outboxCipher.encrypt });

  const identityRouter = createIdentityRouter({ ports: operationsPorts, config });
  const identityService = identityRouter.identityService;
  const identity = identityRouter.identityMiddleware;
  const commerceIdentity = Object.freeze({
    ...identity,
    createGuestOrderProof: identityService.createGuestOrderProof,
    revokeGuestOrderProofs: identityService.revokeGuestOrderProofs,
  });

  let contentService;
  let commerceService;
  let paymentsService;
  const catalogService = createCatalogService({
    productRepository: createMongooseCatalogRepository(),
    inventoryPort: {
      async getAvailability(ids, options) {
        if (!commerceService) throw unavailable('DATABASE_UNAVAILABLE', 'Tồn kho chưa sẵn sàng');
        const rows = await commerceService.getAvailability(ids, options);
        return rows.map(({ productId, available }) => ({
          productId,
          available: Number.isFinite(available) && available > 0,
        }));
      },
    },
    storyPort: {
      getPublishedStoryById(id, options) {
        if (!contentService) throw unavailable('DATABASE_UNAVAILABLE', 'Nội dung công khai chưa sẵn sàng');
        return contentService.getPublishedStoryById(id, options);
      },
    },
    auditPort: operationsPorts,
    mediaProvider: env.mediaStorageDriver === 'local'
      ? createLocalMediaProvider({ storageDir: env.mediaStoragePath, publicBaseUrl: env.mediaPublicBaseUrl })
      : createUnavailableMediaProvider(),
  });

  const auditService = createAuditService({ AuditLog });
  const notificationService = createNotificationService({ Notification });
  const businessSettingsService = createBusinessSettingsService({ BusinessSetting, auditService });
  const dashboardService = createDashboardService({
    Order,
    Ticket,
    Contact,
    Notification,
    financeLedger: createFinanceLedgerPort({ PaymentEvent, CodCollection, Refund }),
  });
  const outboxService = createOutboxService({ OutboxEvent, encryptMailPayload: outboxCipher.encrypt });

  const contentRouter = createContentRouter({
    requireCapability: identity.requireCapability,
    csrfProtection: identity.csrfProtection,
    productPort: catalogService,
    auditPort: operationsPorts,
  });
  contentService = contentRouter.contentService;
  const publishedContentPort = createPublishedContentPort(contentService);

  const accountService = createAccountService({ ports: { catalogService }, config });
  const actorResolvers = makeActorResolvers(identity, identityService, config);
  const commerceConfig = { ...config };
  const paymentBridge = Object.freeze({
    isConfigured: () => paymentsService?.isConfigured() === true,
    getReservationExpiryStatus: (...args) => paymentsService
      ? paymentsService.getReservationExpiryStatus(...args)
      : 'unknown',
  });
  const settingsPort = Object.freeze({ getBusinessSettings: () => businessSettingsService.get() });
  const shippingPort = createShippingZoneQuotePort();
  const cancellationRefundPort = Object.freeze({
    requestOrderCancellationRefund: (...args) => {
      if (!paymentsService) throw unavailable('PAYMENT_UNAVAILABLE', 'Refund service chưa sẵn sàng');
      return paymentsService.requestOrderCancellationRefund(...args);
    },
  });

  const commerceCatalogPort = Object.freeze({
    async getCheckoutProducts(ids, options) {
      const products = await catalogService.getCheckoutProducts(ids, options);
      return products.map((product) => ({
        ...product,
        id: product.productId,
        // This port reads only published products from the catalog repository.
        status: 'published',
      }));
    },
  });
  commerceService = createCommerceService({
    ports: {
      catalog: commerceCatalogPort,
      settings: settingsPort,
      shipping: shippingPort,
      outbox: operationsPorts,
      address: accountService,
      payment: paymentBridge,
      identity: commerceIdentity,
      refunds: cancellationRefundPort,
    },
    config: commerceConfig,
  });
  paymentsService = createPaymentsService({
    ports: { commerceService, ...operationsPorts },
    config,
  });

  const assistantRouter = createAssistantRouter({
    ports: {
      identityMiddleware: identity,
      catalogPort: catalogService,
      publishedContentPort,
    },
    config,
  });
  const assistantTranscript = createAssistantTranscriptPort(assistantRouter.assistantService);
  const supportRouter = createSupportRouter({
    ports: {
      identityMiddleware: identity,
      commerce: commerceService,
      catalog: catalogService,
      operations: operationsPorts,
      assistantTranscript,
    },
    config,
  });

  const accountRouter = createAccountRouter({ ports: { accountService, identityMiddleware: identity }, config });
  const commerceRouter = createCommerceRouter({
    ports: {
      commerceService,
      identity: commerceIdentity,
      resolveActor: actorResolvers.resolveActor,
      resolveOrderActor: actorResolvers.resolveOrderActor,
      catalog: catalogService,
      address: accountService,
      settings: settingsPort,
      shipping: shippingPort,
      payment: paymentBridge,
      outbox: operationsPorts,
    },
    config: commerceConfig,
  });
  const paymentsRouter = createPaymentsRouter({
    ports: {
      paymentsService,
      identity,
      resolveOrderActor: actorResolvers.resolveOrderActor,
    },
    config,
  });
  const catalogRouter = createCatalogRouter({
    service: catalogService,
    requireAdmin: identity.requireCapability('catalog.manage'),
    csrfProtection: identity.csrfProtection,
  });
  const operationsRouter = createOperationsRouter({
    auth: identity,
    models: { Order, Ticket, Contact, Notification, BusinessSetting, OutboxEvent, AuditLog },
    notificationService,
    auditService,
    dashboardService,
    settingsService: businessSettingsService,
    outboxService,
  });

  let smtpTransport = null;
  if (env.smtpConfigured) {
    smtpTransport = createNodemailerTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      user: env.smtpUser,
      password: env.smtpPassword,
      timeoutMs: env.smtpTimeoutMs,
    });
  }
  const mailProvider = createSmtpProvider({
    transporter: smtpTransport,
    from: env.smtpFrom,
    publicWebUrl: env.publicWebUrl,
    timeoutMs: env.smtpTimeoutMs,
  });

  const alertOperationsAdmins = async (event, { session } = {}) => {
    let query = User.find({ role: 'admin', status: 'active' }).select('_id');
    if (session) query = query.session(session);
    const admins = await query.lean().exec();
    if (!admins.length) return;
    await notificationService.appendForDelivery({
      recipients: admins.map((admin) => String(admin._id)),
      category: event.category,
      title: event.title,
      body: event.body,
      href: event.href,
    }, event.eventKey, { session });
  };
  const outboxWorker = createOutboxWorker({
    mailProvider,
    decryptMailPayload: outboxCipher.decrypt,
    notificationService,
    auditService,
    alertOperationsAdmins,
    onFailure: ({ errorCode, state }) => console.warn(`[outbox.worker] ${errorCode} ${state}`),
  });

  const reservationJob = createReleaseExpiredReservationsJob({
    commerceService,
    logger: { warn: (message) => console.warn(`[reservation.expiry] ${message}`) },
  });
  const reconciliationJob = createReconcilePendingAttemptsJob({ paymentsService });
  let workerStops = [];
  let workersStarted = false;

  const domainRouters = [
    { prefix: '', router: identityRouter },
    { prefix: '', router: accountRouter },
    { prefix: '', router: catalogRouter },
    { prefix: '', router: contentRouter },
    { prefix: '', router: commerceRouter },
    { prefix: '', router: paymentsRouter },
    { prefix: '', router: supportRouter },
    { prefix: '', router: assistantRouter },
    { prefix: '', router: operationsRouter },
  ];

  async function startWorkers() {
    if (workersStarted) return;
    workersStarted = true;
    workerStops = [
      startOutboxWorker(outboxWorker, {
        onError: ({ code }) => console.warn(`[outbox.worker] ${code}`),
      }),
      startPeriodicJob(reservationJob, {
        name: 'reservation.expiry',
        intervalMs: env.reservationSweepIntervalMs,
      }),
    ];
    if (paymentsService.isConfigured()) {
      workerStops.push(startPeriodicJob(reconciliationJob, {
        name: 'payment.reconciliation',
        intervalMs: env.paymentReconciliationIntervalMs,
      }));
    }
  }

  async function stopWorkers() {
    const stops = workerStops;
    workerStops = [];
    workersStarted = false;
    await Promise.allSettled(stops.map((worker) => worker.stop()));
    if (smtpTransport && typeof smtpTransport.close === 'function') smtpTransport.close();
  }

  return Object.freeze({
    domainRouters,
    services: Object.freeze({
      identityService,
      accountService,
      catalogService,
      commerceService,
      paymentsService,
      contentService,
      supportService: supportRouter.supportService,
      assistantService: assistantRouter.assistantService,
      businessSettingsService,
      operationsPorts,
    }),
    startWorkers,
    stopWorkers,
  });
}
