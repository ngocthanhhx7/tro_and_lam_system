// Reveal the mounted route promptly. Page sections keep their own loading/error
// states; background API calls, fonts and offscreen images must not lock the app.
export function startStartupLoader(root) {
  const loader = document.getElementById('startup-loader');
  if (!loader) return;
  let finished = false;
  let idleTimer;
  const minimumUntil = performance.now() + 450;
  performance.mark?.('tro-lam:startup-start');

  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(idleTimer);
    window.clearTimeout(deadline);
    observer.disconnect();
    root.removeAttribute('inert');
    root.removeAttribute('aria-busy');
    document.body.classList.remove('site-is-loading');
    loader.classList.add('startup-loader--leaving');
    performance.mark?.('tro-lam:startup-ready');
    window.setTimeout(() => loader.remove(), 380);
  };

  function schedule() {
    if (finished) return;
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      if (root.hasChildNodes() && !root.querySelector('.route-loading')) finish();
    }, Math.max(80, minimumUntil - performance.now()));
  }

  const observer = new MutationObserver(schedule);
  observer.observe(root, { subtree: true, childList: true });
  const deadline = window.setTimeout(finish, 2500);
  schedule();
}
