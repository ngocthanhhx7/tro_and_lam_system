import { useEffect, useState } from 'react';
import { getJson } from '../services/httpClient.js';

export function useApiHealth() {
  const [status, setStatus] = useState('checking');
  useEffect(() => {
    const controller = new AbortController();
    getJson('/health/ready', { signal: controller.signal })
      .then(() => setStatus('ready'))
      .catch((error) => { if (error.name !== 'AbortError') setStatus('unavailable'); });
    return () => controller.abort();
  }, []);
  return status;
}
