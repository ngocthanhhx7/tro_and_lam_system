import { useCallback, useEffect, useMemo, useState } from 'react';
import { clearCsrfToken } from '../services/httpClient.js';
import { identityApi } from '../services/identity/identity.api.js';
import { AuthContext } from './auth.context.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const response = await identityApi.me();
      setUser(response.data);
      setErrorCode(null);
      return response.data;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        setUser(null);
        setErrorCode(error.code);
        return null;
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let live = true;
    identityApi.me().then((response) => {
      if (live) {
        setUser(response.data);
        setErrorCode(null);
      }
    }).catch((error) => {
      if (live && (error.status === 401 || error.status === 403)) {
        setUser(null);
        setErrorCode(error.code);
      }
    }).finally(() => {
      if (live) setLoading(false);
    });
    return () => { live = false; };
  }, []);

  const logout = useCallback(async () => {
    await identityApi.logout();
    clearCsrfToken();
    setUser(null);
    setErrorCode(null);
  }, []);

  const value = useMemo(() => ({ user, loading, errorCode, refresh, setUser, logout }), [user, loading, errorCode, refresh, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
