import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import DecorativeMotif from './DecorativeMotif.jsx';
import './story-page-decorations.css';

const sections = [
  { name: 'hero', host: '.story-brand__hero', items: [
    { pane: '.story-brand__hero-copy', motif: 'lotus', max: 620, opacity: .2 },
  ] },
  { name: 'origin', host: '.story-brand__origin', items: [
    { pane: '.story-brand__origin-copy', motif: 'pavilion', max: 540, opacity: .17 },
  ] },
  { name: 'film', host: '.heritage-film', items: [
    { pane: '.heritage-film__copy', motif: 'craneClouds', max: 176, opacity: .09, light: true, anchor: 'bottom-right' },
  ] },
  { name: 'philosophy', host: '.story-brand__philosophy', items: [
    { pane: '.story-brand__philosophy-grid > div:first-child', motif: 'drum', max: 420, opacity: .12 },
    { pane: '.story-brand__philosophy-copy', motif: 'bamboo', max: 380, opacity: .13 },
  ] },
  { name: 'today', host: '.story-brand__today', items: [
    { pane: '.story-brand__today-copy', motif: 'birdBlossoms', max: 560, opacity: .17 },
    { pane: '.story-brand__steps li:nth-child(1)', motif: 'drum', max: 190, opacity: .12, fitPane: true },
    { pane: '.story-brand__steps li:nth-child(2)', motif: 'lotus', max: 190, opacity: .12, fitPane: true },
    { pane: '.story-brand__steps li:nth-child(3)', motif: 'bamboo', max: 190, opacity: .12, fitPane: true },
    { pane: '.story-brand__steps li:last-child', motif: 'riverLotus', max: 190, opacity: .12, fitPane: true },
  ] },
  { name: 'mission', host: '.story-brand__mission', items: [
    { pane: '.story-brand__mission-card--mission .story-brand__mission-copy', motif: 'bamboo', max: 280, opacity: .055 },
    { pane: '.story-brand__mission-card--vision .story-brand__mission-copy', motif: 'heritageGate', max: 280, opacity: .055, light: true },
  ] },
  { name: 'values', host: '.story-brand__values', items: [
    { pane: '.core-values__choices', motif: 'heritageGate', max: 420, opacity: .08 },
  ] },
  { name: 'closing', host: '.story-brand__closing', items: [
    { pane: '.story-brand__closing', motif: 'craneClouds', max: 380, opacity: .12, light: true, anchor: 'right' },
  ] },
];

function intersects(a, b) {
  return a.x < b.x + b.w + 8 && a.x + a.w > b.x - 8
    && a.y < b.y + b.h + 8 && a.y + a.h > b.y - 8;
}

function measureDecorations() {
  const page = document.querySelector('.story-brand');
  if (!page) return [];
  const mobile = window.innerWidth < 768;
  const scale = mobile ? .7 : window.innerWidth < 1200 ? .88 : 1;
  return sections.flatMap((section) => {
    const host = page.querySelector(section.host);
    if (!host) return [];
    const bounds = host.getBoundingClientRect();
    const relative = (element) => {
      const r = element.getBoundingClientRect();
      return { x: r.left - bounds.left, y: r.top - bounds.top, w: r.width, h: r.height };
    };
    const photos = [...host.querySelectorAll('.story-brand__image, .heritage-film__visual, .core-values__detail')].map(relative);
    const slots = [];
    for (const item of section.items) {
      const element = item.pane === section.host ? host : host.querySelector(item.pane);
      if (!element) continue;
      const pane = relative(element);
      const maximum = Math.min(item.max * scale, pane.w * .96, pane.h + (mobile || item.fitPane ? 0 : 160), bounds.width - 24, bounds.height - 24);
      // Fit a complete square image in the section; never crop it or cover a photo.
      for (const factor of [1, .94, .88, .8, .7, .6, .5]) {
        const size = maximum * factor;
        if (size < 48) break;
        let x = pane.x + (pane.w - size) / 2;
        let y = pane.y + (pane.h - size) / 2;
        if (item.anchor) x = pane.x + pane.w - size - 24;
        if (item.anchor === 'bottom-right') y = pane.y + pane.h - size - 16;
        const box = {
          x: Math.max(12, Math.min(x, bounds.width - size - 12)),
          y: Math.max(12, Math.min(y, bounds.height - size - 12)),
          w: size, h: size,
        };
        if (photos.some((photo) => intersects(box, photo)) || slots.some((slot) => intersects(box, slot))) continue;
        slots.push({ ...box, ...item, opacity: item.opacity * (mobile ? .65 : 1), id: `${section.name}-${item.motif}` });
        break;
      }
    }
    const style = getComputedStyle(host);
    return [{ name: section.name, host, slots, width: bounds.width, height: bounds.height,
      left: -parseFloat(style.borderLeftWidth), top: -parseFloat(style.borderTopWidth) }];
  });
}

export default function StoryPageDecorations() {
  const [plans, setPlans] = useState([]);
  useEffect(() => {
    let active = true;
    let frame;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => { if (active) setPlans(measureDecorations()); });
    };
    const observer = new ResizeObserver(schedule);
    const page = document.querySelector('.story-brand');
    for (const section of sections) {
      const host = page?.querySelector(section.host);
      if (!host) continue;
      observer.observe(host);
      for (const item of section.items) {
        const pane = host.querySelector(item.pane);
        if (pane) observer.observe(pane);
      }
    }
    window.addEventListener('resize', schedule);
    document.fonts.ready.then(() => { if (active) schedule(); });
    schedule();
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return plans.map((plan) => createPortal(<div
    className="story-ornament-layer"
    data-story-section={plan.name}
    aria-hidden="true"
    style={{ left: plan.left, top: plan.top, width: plan.width, height: plan.height }}
  >{plan.slots.map((slot) => <div
      key={slot.id}
      className={`story-motif${slot.light ? ' story-motif--light' : ''}`}
      data-story-motif={slot.id}
      style={{ left: slot.x, top: slot.y, width: slot.w, height: slot.h }}
    >
      <DecorativeMotif motif={slot.motif} placement="canvas" size={`${slot.w}px`} opacity={slot.opacity} breakpoint="mobile" />
    </div>)}</div>, plan.host, plan.name));
}
