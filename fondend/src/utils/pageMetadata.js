function setMeta(selector, attribute, key, content) {
  let meta = document.head.querySelector(selector);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, key);
    document.head.append(meta);
  }
  meta.content = content;
}

export function setPageMetadata({ title, description }) {
  document.title = title;
  setMeta('meta[name="description"]', 'name', 'description', description);
  setMeta('meta[property="og:title"]', 'property', 'og:title', title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', description);
  setMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
  setMeta('meta[property="og:locale"]', 'property', 'og:locale', 'vi_VN');
  setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary');
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
}
