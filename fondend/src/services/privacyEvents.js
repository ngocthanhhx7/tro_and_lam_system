export const PRIVACY_STORAGE_KEY = 'tro-lam:privacy-revision';
export const PRIVACY_CHANGED_EVENT = 'tro-lam:privacy-changed';

// A nonce only: never put session tokens, order IDs or personal data in storage.
export function announcePrivacyChange({ local = false } = {}) {
  try { localStorage.setItem(PRIVACY_STORAGE_KEY, `${Date.now()}:${crypto.randomUUID()}`); }
  catch { /* Storage can be disabled; focus checks still revalidate sessions. */ }
  if (local) window.dispatchEvent(new Event(PRIVACY_CHANGED_EVENT));
}
