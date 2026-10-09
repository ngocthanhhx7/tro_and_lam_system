export const count = (value) => Number.isSafeInteger(value) ? new Intl.NumberFormat('vi-VN').format(value) : '—';

export function downloadCsv(filename, rows) {
  const cell = (value) => `"${String(value ?? '').replace(/^[=+@-]/u, "'$&").replaceAll('"', '""')}"`;
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
