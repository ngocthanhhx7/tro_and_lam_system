import { useEffect, useRef, useState } from 'react';

export default function HeroMotion() {
  const video = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const player = video.current;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyPreference = () => {
      if (preference.matches) player.pause();
      else player.play().catch(() => {});
    };
    applyPreference();
    preference.addEventListener('change', applyPreference);
    return () => { preference.removeEventListener('change', applyPreference); player.pause(); };
  }, []);

  return <>
    <video ref={video} className="atelier-hero__image" muted loop playsInline preload="metadata" poster="/assets/video/tro-lam-banner-poster.jpg" aria-hidden="true" onError={() => setFailed(true)}>
      <source src="/assets/video/tro-lam-banner.mp4" type="video/mp4" />
    </video>
    {failed && <img className="atelier-hero__image" src="/assets/video/tro-lam-banner-poster.jpg" alt="" />}
  </>;
}
