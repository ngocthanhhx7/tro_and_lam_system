let pendingRequests = 0;
let onRequestChange = null;

// Track only startup requests; normal navigation never reopens the overlay.
export function beginStartupRequest() {
  if (!onRequestChange) return () => {};
  pendingRequests += 1;
  onRequestChange();
  return () => {
    pendingRequests -= 1;
    onRequestChange?.();
  };
}

export function startStartupLoader(root) {
  const loader = document.getElementById('startup-loader');
  if (!loader) return;
  let finished = false;
  let idleTimer;
  let fontsReady = !document.fonts;
  const posters = new Map();
  const minimumUntil = performance.now() + 450;

  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(idleTimer);
    clearTimeout(deadline);
    observer.disconnect();
    onRequestChange = null;
    root.removeEventListener('load', schedule, true);
    root.removeEventListener('error', schedule, true);
    window.removeEventListener('load', schedule);
    root.removeAttribute('inert');
    root.removeAttribute('aria-busy');
    document.body.classList.remove('site-is-loading');
    loader.classList.add('startup-loader--leaving');
    window.setTimeout(() => loader.remove(), 380);
  };

  const inViewport = (element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.top < window.innerHeight && box.bottom > 0;
  };

  const ready = () => {
    if (!root.hasChildNodes() || pendingRequests > 0 || !fontsReady || document.readyState !== 'complete') return false;
    if (root.querySelector('.route-loading, [aria-busy="true"]')) return false;
    const images = [...root.querySelectorAll('img')].filter(inViewport);
    for (const video of root.querySelectorAll('video[poster]')) {
      if (!inViewport(video)) continue;
      const src = video.poster;
      if (!posters.has(src)) {
        const image = new Image();
        image.onload = image.onerror = schedule;
        image.src = src;
        posters.set(src, image);
      }
      images.push(posters.get(src));
    }
    return images.every((image) => image.complete);
  };

  function schedule() {
    if (finished) return;
    clearTimeout(idleTimer);
    // Give React time to commit responses and start dependent requests/images.
    idleTimer = window.setTimeout(() => {
      if (ready()) finish();
    }, Math.max(180, minimumUntil - performance.now()));
  }

  const observer = new MutationObserver(schedule);
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'srcset', 'aria-busy'] });
  const deadline = window.setTimeout(finish, 12_000);
  onRequestChange = schedule;
  root.addEventListener('load', schedule, true);
  root.addEventListener('error', schedule, true);
  window.addEventListener('load', schedule);
  document.fonts?.ready.then(() => { fontsReady = true; schedule(); });
  schedule();
}
