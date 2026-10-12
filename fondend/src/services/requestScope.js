// Each load owns a revision. Cleanup or a newer load makes its result obsolete.
export function createRequestScope() {
  let revision = 0;
  return Object.freeze({
    begin() { const current = ++revision; return () => current === revision; },
    capture() { const current = revision; return () => current === revision; },
    invalidate() { revision += 1; },
  });
}
