function setMeta(selector, attribute, key, content) {
  let meta = document.head.querySelector(selector);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, key);
    document.head.append(meta);
  }
  meta.content = content;
}

export function setPageIndexability(indexable) {
  const robotsMeta = document.head.querySelector('meta[name="robots"]');
  if (indexable) {
    robotsMeta?.remove();
    return;
  }
  setMeta('meta[name="robots"]', 'name', 'robots', 'noindex, follow');
}

export function setPageMetadata({ title, description, locale = 'vi' }) {
  const openGraphLocale = locale === 'en' ? 'en_US' : 'vi_VN';
  document.title = title;
  setMeta('meta[name="description"]', 'name', 'description', description);
  setMeta('meta[property="og:title"]', 'property', 'og:title', title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', description);
  setMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
  setMeta('meta[property="og:locale"]', 'property', 'og:locale', openGraphLocale);
  setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary');
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
}

export function setPublishedContentMetadata({ title, blocks = [], sections = [], locale = 'vi' }) {
  const cleanTitle = String(title || '').replace(/\s+/gu, ' ').trim();
  if (!cleanTitle) return;
  const textBlocks = [
    ...blocks,
    ...sections.flatMap((section) => section?.body || []),
  ];
  const firstParagraph = textBlocks.find((block) => block?.type === 'paragraph' && typeof block.text === 'string' && block.text.trim());
  const description = String(firstParagraph?.text || cleanTitle).replace(/\s+/gu, ' ').trim().slice(0, 160);
  setPageMetadata({
    title: `${cleanTitle} | Gốm Chu Đậu | TRO & LAM`,
    description,
    locale,
  });
}
