import nodemailer from 'nodemailer';

/** Create a real, TLS-protected SMTP transport from server-only environment config. */
export function createNodemailerTransport({ host, port, secure, user, password, timeoutMs = 15_000 } = {}) {
  if (![host, user, password].every((value) => typeof value === 'string' && value.trim())
    || !Number.isSafeInteger(port) || port < 1 || port > 65535
    || typeof secure !== 'boolean') {
    throw new TypeError('SMTP transport requires validated host, port, TLS mode, username and password');
  }
  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass: password },
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
  });
}
