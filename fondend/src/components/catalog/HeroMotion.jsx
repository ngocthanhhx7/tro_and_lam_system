import { useEffect, useRef, useState } from 'react';

const POSTER = '/assets/video/tro-lam-banner-poster-20261026.jpg';
export default function HeroMotion() {
  const video = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const player = video.current;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection;
    let visible = false;
    let idleReady = false;
    const applyPreference = () => {
      if (!idleReady || !visible || document.hidden || preference.matches || connection?.saveData) {
        player.pause();
        return;
      }
      // The poster renders immediately. Do not compete with route data/images or
      // download the background movie for reduced-motion/data-saving visitors.
      // Choose once when playback is first needed; resizing must not download
      // another movie or reset the current playback position.
      if (!player.getAttribute('src')) {
        player.src = window.matchMedia('(max-width: 760px)').matches
          ? '/assets/video/tro-lam-banner-mobile-20261026.mp4'
          : '/assets/video/tro-lam-banner-desktop-20261026.mp4';
      }
      player.play().catch(() => {});
    };
    const idle = () => { idleReady = true; applyPreference(); };
    const idleHandle = window.requestIdleCallback ? window.requestIdleCallback(idle, { timeout: 1500 }) : window.setTimeout(idle, 250);
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      applyPreference();
    }, { threshold: 0.01 }) : null;
    if (observer) observer.observe(player);
    else visible = true;
    preference.addEventListener('change', applyPreference);
    connection?.addEventListener?.('change', applyPreference);
    document.addEventListener('visibilitychange', applyPreference);
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(idleHandle);
      else window.clearTimeout(idleHandle);
      observer?.disconnect();
      preference.removeEventListener('change', applyPreference);
      connection?.removeEventListener?.('change', applyPreference);
      document.removeEventListener('visibilitychange', applyPreference);
      player.pause();
    };
  }, []);

  return <>
    <video ref={video} className="atelier-hero__image" muted loop playsInline preload="none" poster={POSTER} aria-hidden="true" onError={() => setFailed(true)} />
    {failed && <img className="atelier-hero__image" src={POSTER} alt="" />}
  </>;
}
