import { useCallback, useState } from 'react';

export function useIdentityRequest() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const run = useCallback(async (request) => {
    setPending(true);
    setError(null);
    try {
      return await request();
    } catch (requestError) {
      setError(requestError);
      throw requestError;
    } finally {
      setPending(false);
    }
  }, []);
  return { pending, error, setError, run };
}
