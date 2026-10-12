import { useEffect, useState } from 'react';
import { commerceApi } from '../../services/commerce/commerce.api.js';

export default function useAutomaticQuote(body, enabled) {
  const key = JSON.stringify(body);
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let refreshTimer;
    const controller = new AbortController();
    async function calculate() {
      setResult({ key, retry, pending: true });
      try {
        const quote = await commerceApi.quoteCheckout(JSON.parse(key), { signal: controller.signal });
        if (!active) return;
        setResult({ key, retry, quote });
        const expiresAt = Date.parse(quote.quoteExpiresAt);
        if (Number.isFinite(expiresAt)) refreshTimer = window.setTimeout(calculate, Math.max(1000, expiresAt - Date.now() - 5000));
      } catch (error) {
        if (active) setResult({ key, retry, error });
      }
    }
    const timer = window.setTimeout(calculate, 500);
    return () => { active = false; controller.abort(); window.clearTimeout(timer); window.clearTimeout(refreshTimer); };
  }, [key, enabled, retry]);
  const current = enabled && result?.key === key && result?.retry === retry ? result : null;
  return { quote: current?.quote || null, error: current?.error || null,
    pending: enabled && (!current || current.pending === true), retry: () => setRetry(value => value + 1) };
}
