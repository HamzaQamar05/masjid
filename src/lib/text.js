export function initials(name = 'Mujtama') {
  return name.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

export function safeList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

export function listToText(value) {
  return Array.isArray(value) ? value.join(', ') : value || '';
}

export function textToList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

export function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}
