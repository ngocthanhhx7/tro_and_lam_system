import test from 'node:test';
import assert from 'node:assert/strict';
import { startStartupLoader } from '../../fondend/src/utils/startupLoader.js';

function fixture(t, { routeLoading = false, mounted = true } = {}) {
  const originals = new Map(['document', 'window', 'MutationObserver', 'performance'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => { for (const [key, descriptor] of originals) descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]; });
  let clock = 0, sequence = 0, removed = 0, disconnected = false, mutation;
  const timers = new Map(), marks = [], attributes = new Set(['inert', 'aria-busy']);
  const leaving = new Set(), bodyClasses = new Set(['site-is-loading']);
  const state = { routeLoading, mounted };
  const root = { hasChildNodes: () => state.mounted, querySelector: selector => { assert.equal(selector, '.route-loading'); return state.routeLoading ? {} : null; }, removeAttribute: name => attributes.delete(name) };
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => clock, mark: name => marks.push(name) } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { setTimeout(fn, delay) { const id = ++sequence; timers.set(id, { fn, at: clock + delay }); return id; }, clearTimeout: id => timers.delete(id) } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { readyState: 'loading', fonts: { ready: new Promise(() => {}) }, body: { classList: { remove: name => bodyClasses.delete(name) } }, getElementById: () => ({ classList: { add: name => leaving.add(name) }, remove: () => removed++ }) } });
  Object.defineProperty(globalThis, 'MutationObserver', { configurable: true, value: class { constructor(fn) { mutation = fn; } observe() {} disconnect() { disconnected = true; } } });
  const tick = ms => { const end = clock + ms; while (true) { const next = [...timers].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) break; clock = next[1].at; timers.delete(next[0]); next[1].fn(); } clock = end; };
  return { root, state, tick, mutate: () => mutation(), attributes, marks, bodyClasses, leaving, removed: () => removed, disconnected: () => disconnected };
}

test('startup reveals mounted route without waiting for fonts, page load or background work', t => {
  const f = fixture(t);
  startStartupLoader(f.root);
  f.tick(449); assert.ok(f.attributes.has('inert'));
  f.tick(1); assert.equal(f.attributes.has('inert'), false); assert.equal(f.attributes.has('aria-busy'), false);
  assert.equal(f.bodyClasses.size, 0); assert.ok(f.disconnected());
  assert.deepEqual(f.marks, ['tro-lam:startup-start', 'tro-lam:startup-ready']);
  f.tick(380); assert.equal(f.removed(), 1);
});

test('startup keeps route loading visible but releases the app within its bounded deadline', t => {
  const f = fixture(t, { routeLoading: true }); startStartupLoader(f.root);
  f.tick(450); assert.ok(f.attributes.has('inert'));
  f.tick(2050); assert.equal(f.attributes.has('inert'), false);
  f.mutate(); f.tick(1000); assert.equal(f.removed(), 1);
});

test('committing a ready route releases startup before the deadline', t => {
  const f = fixture(t, { routeLoading: true }); startStartupLoader(f.root);
  f.tick(600); f.state.routeLoading = false; f.mutate(); f.tick(80);
  assert.equal(f.attributes.has('inert'), false);
});
