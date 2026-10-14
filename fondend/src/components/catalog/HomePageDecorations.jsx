import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import DecorativeMotif from './DecorativeMotif.jsx';
import './homepage-decorations.css';

const targets = {
  hero: '.atelier-hero',
  lifestyle: '[aria-labelledby="home-lifestyle-title"]',
  diplomacy: '[aria-labelledby="home-diplomacy-title"]',
  featured: '.atelier-featured',
  film: '.heritage-film',
  closing: '.closing-note',
  footer: '.catalog-footer',
};

function overlaps(a, b, gap = 6) {
  return a.x < b.x + b.w + gap && a.x + a.w > b.x - gap
    && a.y < b.y + b.h + gap && a.y + a.h > b.y - gap;
}

// Use rendered text lines, not full-width paragraph boxes, to find actual whitespace.
function contentBounds(host, bounds) {
  const boxes = [];
  const relative = (r) => ({ x: r.left, y: r.top - bounds.top, w: r.width, h: r.height });
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (!node.textContent.trim() || node.parentElement.closest('.home-ornament-layer, .decorative-motif')) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) if (rect.width && rect.height) boxes.push(relative(rect));
  }
  for (const element of host.querySelectorAll('a, button, .product-line-slideshow, .product-card, .heritage-film__visual')) {
    const rect = element.getBoundingClientRect();
    if (rect.width && rect.height) boxes.push(relative(rect));
  }
  return boxes;
}

function measureDecorations() {
  const site = document.querySelector('.public-site');
  if (!site?.querySelector('.atelier-hero')) return [];
  const width = site.getBoundingClientRect().width;
  const desktop = window.innerWidth >= 1200;
  const mobile = window.innerWidth < 768;
  const plans = [];
  for (const [name, selector] of Object.entries(targets)) {
    const host = site.querySelector(selector);
    if (!host) continue;
    const bounds = host.getBoundingClientRect();
    const rect = (element) => {
      const r = element.getBoundingClientRect();
      return { x: r.left, y: r.top - bounds.top, w: r.width, h: r.height };
    };
    const blocked = contentBounds(host, bounds);
    const images = [...host.querySelectorAll('.product-line-slideshow, .product-card, .heritage-film__visual')].map(rect);
    const slots = [];
    const add = (id, motif, box, opacity, variant = 'whole', light = false, backdrop = false) => {
      if (box.w < 18 || box.h < 12 || box.x < -.5 || box.y < 0
        || box.x + box.w > width + .5 || box.y + box.h > bounds.height + .5
        || (backdrop ? images : blocked).some((b) => overlaps(box, b))
        || slots.some((s) => overlaps(box, s, 10))) return;
      slots.push({ id, motif, ...box, opacity, variant, light, backdrop });
    };
    const edge = (id, motif, side, y, size, opacity, light = false, room) => {
      const free = room ?? (side === 'left' ? bounds.left - 10 : width - bounds.right - 10);
      const w = Math.min(free, size);
      if (w < 26) return;
      add(id, motif, { x: side === 'left' ? 0 : width - w, y, w, h: size }, opacity, side === 'left' ? 'edge-left' : 'edge-right', light);
    };
    const fragment = (id, x, y, w, opacity, variant = 'clouds', light = false, h = w * .27, backdrop = false) => {
      add(id, variant === 'water' ? 'riverLotus' : 'craneClouds', { x, y, w, h }, opacity, variant, light, backdrop);
    };

    if (name === 'hero' && desktop) {
      // Reserve the central artist area as well as all text and controls.
      blocked.push({ x: width * .1, y: bounds.height * .1, w: width * .8, h: bounds.height * .82 });
      const copy = rect(host.querySelector('.atelier-hero__content'));
      const room = Math.min(copy.x - 10, width * .08);
      fragment('hero-clouds', 4, 12, Math.min(140, room - 4), .28);
      edge('hero-branch', 'swallowBlossoms', 'right', 12, 220, .32, false, room);
      fragment('hero-water', 4, bounds.height - 54, Math.min(120, room - 4), .2, 'water');
    }

    if (name === 'lifestyle' || name === 'diplomacy') {
      const lifestyle = name === 'lifestyle';
      const image = rect(host.querySelector('.product-line-slideshow'));
      const copy = rect(host.querySelector('.collection-story__copy'));
      const highlights = rect(host.querySelector('.home-product-line__highlights'));
      // Large, pale artwork sits inside the copy column with the text above it.
      // Keep the existing column and image dimensions; only the background moves.
      const sideBySide = copy.y < image.y + image.h && copy.x !== image.x;
      const center = copy.x + copy.w / 2;
      const leftLimit = sideBySide && copy.x > image.x ? image.x + image.w + 12 : 12;
      const rightLimit = sideBySide && copy.x < image.x ? image.x - 12 : width - 12;
      const topLimit = sideBySide ? image.y : copy.y;
      // Fit the entire square artwork, including the leaves at its edges.
      // Its window can extend into the gutter, but never into the product photo.
      const size = Math.min(
        copy.w * (mobile ? 1.1 : 1.16), copy.h + 120,
        2 * Math.min(center - leftLimit, rightLimit - center),
        highlights.y - topLimit - 16,
      );
      const top = sideBySide
        ? Math.min(Math.max(topLimit, copy.y + (copy.h - size) / 2), highlights.y - size - 16)
        : copy.y;
      add(`${name}-copy-background`, lifestyle ? 'lotus' : 'birdBlossoms', {
        x: center - size / 2, y: top, w: size, h: size,
      }, mobile ? .12 : desktop ? .22 : .16, 'whole', false, true);
      if (desktop) {
        edge(`${name}-drum`, 'drum', lifestyle ? 'left' : 'right', image.y + 30, 420, .18);
      }
      if (!mobile) fragment(`${name}-copy-cloud`, copy.x + copy.w * .55, Math.max(12, top - 62), 160, .26);
      if (!mobile) {
        fragment(`${name}-divider`, copy.x + copy.w * .25, highlights.y - 38, 136, .22);
      }
      const items = [...host.querySelectorAll('.home-product-line__products > li')];
      const last = rect(items.at(-1));
      const list = rect(host.querySelector('.home-product-line__products'));
      const twoColumns = last.w < list.w * .7;
      if (lifestyle) {
        // Pale artwork can sit behind the product descriptions, like the copy above.
        // Match each square window to the complete artwork to keep all its edges.
        const pavilionSize = Math.min(
          desktop ? 440 : twoColumns ? 320 : 224,
          list.w * (twoColumns ? .46 : .65), highlights.h - 40,
        );
        add('lifestyle-empty-cell', 'pavilion', {
          x: list.x + list.w - pavilionSize - 12,
          y: bounds.height - pavilionSize - 16, w: pavilionSize, h: pavilionSize,
        }, mobile ? .12 : .18, 'whole', false, true);
        const lotusSize = Math.min(
          desktop ? 380 : twoColumns ? 280 : 200,
          last.w - 16, highlights.h - 64,
        );
        add('lifestyle-highlights-lotus', 'lotus', {
          x: list.x + 12,
          y: twoColumns ? bounds.height - lotusSize - 22 : highlights.y + 84,
          w: lotusSize, h: lotusSize,
        }, mobile ? .1 : .13, 'whole', false, true);
        const cloudWidth = Math.min(150, last.w * .4);
        fragment('lifestyle-highlights-clouds', list.x + 12, highlights.y + 8,
          cloudWidth, mobile ? .14 : .2, 'clouds', false, cloudWidth * .27, true);
      } else {
        const gateSize = Math.min(
          desktop ? 440 : twoColumns ? 320 : 224,
          list.w * (twoColumns ? .46 : .65), highlights.h - 40,
        );
        add('diplomacy-highlights-gate', 'heritageGate', {
          x: list.x + list.w - gateSize - 12,
          y: bounds.height - gateSize - 16, w: gateSize, h: gateSize,
        }, mobile ? .12 : .18, 'whole', false, true);
        const bambooSize = Math.min(
          desktop ? 380 : twoColumns ? 280 : 200,
          last.w - 16, highlights.h - 64,
        );
        add('diplomacy-highlights-bamboo', 'bamboo', {
          x: list.x + 12,
          y: twoColumns ? bounds.height - bambooSize - 22 : highlights.y + 84,
          w: bambooSize, h: bambooSize,
        }, mobile ? .1 : .13, 'whole', false, true);
      }
      fragment(`${name}-water`, bounds.left + 12, bounds.height - 36, mobile ? 80 : 96, mobile ? .14 : .2, 'water');
    }

    if (name === 'featured') {
      if (desktop) {
        edge('featured-lotus', 'lotus', 'left', 170, 360, .3);
        edge('featured-blossoms', 'swallowBlossoms', 'right', Math.max(100, bounds.height - 450), 340, .3);
      }
      fragment('featured-water', width * .5 - 70, bounds.height - 55, mobile ? 80 : 140, .2, 'water');
      if (!mobile) fragment('featured-clouds', bounds.right - 148, 14, 128, .22);
    }

    if (name === 'film' && !mobile) {
      fragment('film-clouds', width - 126, 12, 110, .13, 'clouds', true);
      fragment('film-water', width - 132, bounds.height - 45, 116, .12, 'water', true);
    }

    if (name === 'closing') {
      if (!mobile) {
        for (const size of [320, 280, 240, 200, 160]) {
          const count = slots.length;
          add('closing-crane', 'craneClouds', { x: 12, y: bounds.height - size, w: size, h: size }, .4);
          if (slots.length > count) break;
        }
        for (const size of [320, 280, 240, 200, 160]) {
          const count = slots.length;
          add('closing-lotus', 'lotus', { x: width - size - 12, y: bounds.height - size, w: size, h: size }, .35);
          if (slots.length > count) break;
        }
      } else {
        add('closing-lotus-mobile', 'lotus', { x: width - 56, y: bounds.height - 50, w: 42, h: 42 }, .24);
      }
      fragment('closing-water', width * .5 - 70, bounds.height - 40, mobile ? 80 : 140, .22, 'water');
    }

    if (name === 'footer') {
      if (!mobile) {
        const inner = rect(host.querySelector('.footer-columns'));
        edge('footer-blossoms', 'birdBlossoms', 'left', Math.max(0, bounds.height - 220), 200, .12, true, inner.x - 12);
        edge('footer-drum', 'drum', 'right', Math.max(0, bounds.height - 220), 200, .1, true, width - inner.x - inner.w - 12);
      }
      fragment('footer-water', width * .5 - 54, bounds.height - 16, 108, .12, 'water', true, 12);
    }
    const style = getComputedStyle(host);
    plans.push({ name, host, width, height: bounds.height, left: -bounds.left - parseFloat(style.borderLeftWidth), top: -parseFloat(style.borderTopWidth), slots });
  }
  return plans;
}

function MotifWindow({ slot }) {
  let size = slot.h;
  let left = 0;
  let top = 0;
  if (slot.variant === 'edge-left') left = Math.min(-size * .4, slot.w - size);
  if (slot.variant === 'clouds') { size = slot.w * 1.7; left = -size * .31; top = -size * .83; }
  if (slot.variant === 'water') { size = slot.w * 2.5; left = -slot.w * 1.5; top = -slot.w * 2.06; }
  return <div
    className={`home-motif-window${slot.light ? ' home-motif-window--light' : ''}`}
    data-motif={slot.id}
    data-placement={slot.backdrop ? 'behind-text' : 'whitespace'}
    style={{ left: slot.x, top: slot.y, width: slot.w, height: slot.h }}
  >
    <div className="home-motif-window__image" style={{ left, top }}>
      <DecorativeMotif motif={slot.motif} placement="canvas" size={`${size}px`} opacity={slot.opacity} breakpoint="mobile" />
    </div>
  </div>;
}

export default function HomePageDecorations() {
  const [plans, setPlans] = useState([]);
  useEffect(() => {
    let active = true;
    let frame;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => { if (active) setPlans(measureDecorations()); });
    };
    const observer = new ResizeObserver(schedule);
    for (const selector of Object.values(targets)) {
      const host = document.querySelector(selector);
      if (host) observer.observe(host);
    }
    observer.observe(document.documentElement);
    window.addEventListener('resize', schedule);
    document.fonts.ready.then(() => { if (active) schedule(); });
    schedule();
    return () => { active = false; window.cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', schedule); };
  }, []);

  return plans.map((plan) => createPortal(<div
    className="home-ornament-layer"
    aria-hidden="true"
    data-section={plan.name}
    style={{ left: plan.left, top: plan.top, width: plan.width, height: plan.height }}
  >{plan.slots.map((slot) => <MotifWindow key={slot.id} slot={slot} />)}</div>, plan.host, plan.name));
}
