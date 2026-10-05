import { getJson, requestJson } from '../httpClient.js';

export const identityGet = (path, options) => getJson(path, options);
export const identityPost = (path, body = {}) => requestJson(path, { method: 'POST', body });
export const identityPatch = (path, body) => requestJson(path, { method: 'PATCH', body });

export const identityApi = Object.freeze({
  csrf: () => identityGet('/auth/csrf'),
  me: () => identityGet('/auth/me'),
  register: (body) => identityPost('/auth/register', body),
  verifyEmail: (token) => identityPost('/auth/verify-email', { token }),
  resendVerification: (email) => identityPost('/auth/resend-verification', { email }),
  login: (body) => identityPost('/auth/login', body),
  logout: () => identityPost('/auth/logout'),
  forgotPassword: (email) => identityPost('/auth/forgot-password', { email }),
  resetPassword: (body) => identityPost('/auth/reset-password', body),
  acceptInvitation: (body) => identityPost('/auth/invitations/accept', body),
  requestAppealChallenge: (email) => identityPost('/auth/appeal-challenges', { email }),
  exchangeAppealAccess: (body) => identityPost('/auth/appeal-access', body),
  appeal: () => identityGet('/account/appeals/current'),
  submitAppeal: (message) => identityPost('/account/appeals', { message }),
  updateProfile: (body) => identityPatch('/account/profile', body),
  listUsers: (query = '') => identityGet(`/admin/users${query}`),
  inviteUser: (body) => identityPost('/admin/users', body),
  getUser: (id) => identityGet(`/admin/users/${encodeURIComponent(id)}`),
  updateUser: (id, body) => identityPatch(`/admin/users/${encodeURIComponent(id)}`, body),
  updateUserStatus: (id, body) => identityPost(`/admin/users/${encodeURIComponent(id)}/status`, body),
  updateUserRole: (id, body) => identityPost(`/admin/users/${encodeURIComponent(id)}/role`, body),
  listAppeals: (query = '') => identityGet(`/admin/appeals${query}`),
  decideAppeal: (id, body) => identityPost(`/admin/appeals/${encodeURIComponent(id)}/decision`, body),
});
