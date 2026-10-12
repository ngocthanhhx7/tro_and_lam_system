// Share simultaneous reads only; never retain a resolved response as a cache.
export function createSingleFlightRead(read) {
  let pending;
  return Object.freeze({
    get() {
      if (!pending) {
        const request = Promise.resolve().then(read).finally(() => { if (pending === request) pending = undefined; });
        pending = request;
      }
      return pending;
    },
    invalidate() { pending = undefined; },
  });
}
