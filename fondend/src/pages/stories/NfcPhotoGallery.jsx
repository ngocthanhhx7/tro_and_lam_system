import { useEffect, useRef, useState } from 'react';

export default function NfcPhotoGallery({ images, name }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const dialogRef = useRef(null);
  const selected = images[selectedIndex];
  const counter = `${String(selectedIndex + 1).padStart(2, '0')} / ${String(images.length).padStart(2, '0')}`;

  useEffect(() => {
    if (!viewerOpen) return undefined;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [viewerOpen]);

  function moveImage(direction) {
    setSelectedIndex((index) => (index + direction + images.length) % images.length);
  }

  function navigateThumbnails(event) {
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (selectedIndex + 1) % images.length;
    if (event.key === 'ArrowLeft') nextIndex = (selectedIndex - 1 + images.length) % images.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = images.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    setSelectedIndex(nextIndex);
    event.currentTarget.querySelectorAll('button')[nextIndex].focus();
  }

  return <div className="nfc-photo-gallery">
    <button className="nfc-gallery-stage" type="button" aria-haspopup="dialog" aria-controls="nfc-photo-viewer" aria-label={`Xem ảnh lớn: ${selected.label}`} onClick={() => setViewerOpen(true)}>
      <img id="nfc-hero-image" src={selected.src} alt={selected.alt} width="1600" height="1067" fetchPriority="high" decoding="async" />
      <span className="nfc-gallery-zoom"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6M7 10h6m-3-3v6" /></svg>Xem ảnh lớn</span>
    </button>
    <div className="nfc-gallery-caption" aria-live="polite" aria-atomic="true"><p>{selected.label}</p><span>{counter}</span></div>
    <div className="gn-thumbnails" role="group" aria-label={`Thư viện ảnh ${name}`} onKeyDown={navigateThumbnails}>
      {images.map((image, index) => <button type="button" key={image.src} className={`gn-thumbnail${selectedIndex === index ? ' is-active' : ''}`} aria-pressed={selectedIndex === index} aria-label={`Xem ảnh ${index + 1}: ${image.label}`} aria-controls="nfc-hero-image" onClick={() => setSelectedIndex(index)}><img src={image.thumbnail || image.src} alt="" width="120" height="80" decoding="async" /></button>)}
    </div>
    <dialog id="nfc-photo-viewer" className="nfc-photo-viewer" ref={dialogRef} aria-label={`Thư viện ảnh ${name}`} onClose={() => setViewerOpen(false)} onKeyDown={(event) => {
      if (event.key === 'Tab') {
        const buttons = event.currentTarget.querySelectorAll('button');
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        moveImage(event.key === 'ArrowRight' ? 1 : -1);
      }
    }} onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialogRef.current.close();
    }}>
      {viewerOpen && <>
        <div className="nfc-viewer-toolbar"><p>{name}</p><button type="button" autoFocus onClick={() => dialogRef.current.close()} aria-label="Đóng ảnh lớn">Đóng <span aria-hidden="true">×</span></button></div>
        <figure className="nfc-viewer-figure"><img src={selected.src} alt={selected.alt} width="1600" height="1067" /><figcaption aria-live="polite" aria-atomic="true">{selected.label} <span>{counter}</span></figcaption></figure>
        <div className="nfc-viewer-controls"><button type="button" onClick={() => moveImage(-1)}>Ảnh trước</button><button type="button" onClick={() => moveImage(1)}>Ảnh tiếp</button></div>
      </>}
    </dialog>
  </div>;
}
