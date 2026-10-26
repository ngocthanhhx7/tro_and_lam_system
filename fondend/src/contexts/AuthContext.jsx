import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clearCsrfToken } from '../services/httpClient.js';
import { identityApi } from '../services/identity/identity.api.js';
import { AuthContext } from './auth.context.js';
import { invalidateCartRead } from '../services/account/cartRead.js';
import { isProofScopedPath, PRIVACY_CHANGED_EVENT, PRIVACY_STORAGE_KEY } from '../services/privacyEvents.js';

export function AuthProvider({ children }) {
  const [user, updateUser] = useState(null);
  const authRevision = useRef(0);
  const privacyRequest = useRef(0);
  const currentUser = useRef(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState(null);
  const [privacyRevision, setPrivacyRevision] = useState(0);
  const [privacyPending, setPrivacyPending] = useState(false);
  useEffect(() => { currentUser.current = user; }, [user]);
  const setUser = useCallback((value) => {
    authRevision.current += 1;
    privacyRequest.current += 1;
    invalidateCartRead();
    if (currentUser.current?.id !== value?.id || currentUser.current?.role !== value?.role) {
      setPrivacyRevision(current => current + 1);
    }
    updateUser(value);
    setPrivacyPending(false);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    const revision = authRevision.current;
    try {
      const response = await identityApi.me();
      if (revision !== authRevision.current) return null;
      setUser(response.data);
      setErrorCode(null);
      return response.data;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        if (revision !== authRevision.current) return null;
        setUser(null);
        setErrorCode(error.code);
        return null;
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setUser]);

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

  useEffect(() => {
    let active = true;
    let focusCheck;
    const revalidate = () => {
      const revision = ++privacyRequest.current;
      authRevision.current += 1;
      invalidateCartRead();
      clearCsrfToken();
      updateUser(null);
      setLoading(true);
      setPrivacyPending(true);
      setPrivacyRevision(current => current + 1);
      void identityApi.me().then(response => {
        if (active && privacyRequest.current === revision) {
          updateUser(response.data);
          setErrorCode(null);
          setPrivacyPending(false);
          setLoading(false);
        }
      }).catch(error => {
        if (!active || privacyRequest.current !== revision) return;
        if (error.status === 401 || error.status === 403) {
          setErrorCode(error.code);
          setPrivacyPending(false);
          setLoading(false);
        }
        // On an unknown network failure, keep private views unmounted.
      });
    };
    const storageChanged = event => { if (event.key === PRIVACY_STORAGE_KEY) revalidate(); };
    const focused = () => {
      // Restricted proofs can change independently of an active normal session.
      if (isProofScopedPath(window.location.pathname)) {
        revalidate();
        return;
      }
      if (focusCheck) return;
      const revision = authRevision.current;
      focusCheck = identityApi.me().then(response => {
        if (active && revision === authRevision.current) {
          if (currentUser.current?.id !== response.data?.id || currentUser.current?.role !== response.data?.role) revalidate();
        }
      }).catch(error => {
        if (active && revision === authRevision.current && [401, 403].includes(error.status)) {
          if (currentUser.current) revalidate();
        }
      }).finally(() => { focusCheck = null; });
    };
    const restored = event => { if (event.persisted) revalidate(); };
    window.addEventListener('storage', storageChanged);
    window.addEventListener(PRIVACY_CHANGED_EVENT, revalidate);
    window.addEventListener('focus', focused);
    window.addEventListener('pageshow', restored);
    return () => {
      active = false;
      privacyRequest.current += 1;
      window.removeEventListener('storage', storageChanged);
      window.removeEventListener(PRIVACY_CHANGED_EVENT, revalidate);
      window.removeEventListener('focus', focused);
      window.removeEventListener('pageshow', restored);
    };
  }, []);

  const logout = useCallback(async (beforeClear) => {
    await identityApi.logout();
    clearCsrfToken();
    // Navigate in the same update as clearing auth, before a protected route can redirect.
    beforeClear?.();
    setUser(null);
    setErrorCode(null);
  }, [setUser]);

  const value = useMemo(() => ({ user, loading, errorCode, refresh, setUser, logout }), [user, loading, errorCode, refresh, setUser, logout]);
  return <AuthContext.Provider value={value}>{privacyPending
    ? <div role="status">Đang xác minh phiên truy cập… <button type="button" onClick={() => window.location.reload()}>Tải lại</button></div>
    : <Fragment key={privacyRevision}>{children}</Fragment>}</AuthContext.Provider>;
}
