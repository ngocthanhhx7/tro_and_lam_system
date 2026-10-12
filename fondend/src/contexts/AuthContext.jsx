import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clearCsrfToken } from '../services/httpClient.js';
import { identityApi } from '../services/identity/identity.api.js';
import { AuthContext } from './auth.context.js';
import { invalidateCartRead } from '../services/account/cartRead.js';

export function AuthProvider({ children }) {
  const [user, updateUser] = useState(null);
  const authRevision = useRef(0);
  const setUser = useCallback((value) => { authRevision.current += 1; invalidateCartRead(); updateUser(value); }, []);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState(null);

  const refresh = useCallback(async () => {
    const revision = authRevision.current;
    try {
      const response = await identityApi.me();
      if (revision !== authRevision.current) return null;
      invalidateCartRead();
      updateUser(response.data);
      setErrorCode(null);
      return response.data;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        if (revision !== authRevision.current) return null;
        invalidateCartRead();
        updateUser(null);
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
    const revision = authRevision.current;
    identityApi.me().then((response) => {
      if (live && revision === authRevision.current) {
        invalidateCartRead();
        updateUser(response.data);
        setErrorCode(null);
      }
    }).catch((error) => {
      if (live && revision === authRevision.current && (error.status === 401 || error.status === 403)) {
        invalidateCartRead();
        updateUser(null);
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
  }, [setUser]);

  const value = useMemo(() => ({ user, loading, errorCode, refresh, setUser, logout }), [user, loading, errorCode, refresh, setUser, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
