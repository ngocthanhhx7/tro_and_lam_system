export function safeAssistantHref(href) {
  if (typeof href !== 'string' || !/^\/(?!\/)/u.test(href) || href.includes('\\')) return null;
  if ([...href].some(character => character.charCodeAt(0) < 32)) return null;
  return href;
}
