export function createPublishedContentPort(contentService) {
  if (typeof contentService?.getPublishedStory !== 'function' || typeof contentService?.resolveNfc !== 'function') {
    throw new TypeError('Published content port requires story and NFC public resolvers');
  }
  return Object.freeze({
    getPublishedStory: (slug, locale) => contentService.getPublishedStory(slug, locale),
    resolveNfc: (publicId, locale) => contentService.resolveNfc(publicId, locale),
  });
}
