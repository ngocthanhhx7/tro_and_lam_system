const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

export async function getJson(path, { signal } = {}) {
  const response = await fetch(`${baseUrl}${path}`, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Yêu cầu thất bại (${response.status})`);
  return response.json();
}
