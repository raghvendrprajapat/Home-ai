import { expect, it } from 'vitest';
import { createUiStore } from './state';
import { areaDisplay, message, messages } from '../i18n/messages';
it('all bilingual messages exist with matching placeholders and plain text rendering', () => {
  for (const [en, hi] of Object.values(messages)) {
    expect(en.length).toBeGreaterThan(0); expect(hi.length).toBeGreaterThan(0);
    expect([...en.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()).toEqual([...hi.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort());
  }
  expect(message('hi', 'openNamed', { name: 'मेरा घर' })).toBe('मेरा घर खोलें');
  expect(message('en', 'openNamed', { name: '<script>' })).toBe('Open <script>'); // React renders this as text, never HTML.
  expect(areaDisplay(14440000, 'metric')).toEqual({ value: '14.44', unit: 'm²' });
  expect(areaDisplay(1000000, 'imperial')).toEqual({ value: '10.76', unit: 'ft²' });
});
it('UI-only preferences survive restart without persisting routes, drawing data or modal state', () => {
  const files = new Map<string, string>(), storage = { getItem: (key: string) => files.get(key) ?? null, setItem: (key: string, value: string) => { files.set(key, value); } };
  const store = createUiStore(storage); store.getState().setLocale('hi'); store.getState().setUnits('imperial'); store.getState().dismissWelcome(); store.getState().setScreen('projects');
  expect(createUiStore(storage).getState()).toMatchObject({ locale: 'hi', units: 'imperial', onboardingSeen: true, screen: 'editor' });
  expect(Object.keys(JSON.parse([...files.values()][0]!)).sort()).toEqual(['locale', 'onboardingSeen', 'units', 'version']);
  store.getState().setScreen('settings'); store.getState().setScreen('settings');
  expect(store.getState().returnTo).toBe('projects');
});
it('invalid or unavailable preference storage cannot crash or claim settings were remembered', () => {
  const store = createUiStore({ getItem: () => 'broken', setItem: () => { throw new Error('Quota'); } });
  expect(store.getState().locale).toBe('en'); store.getState().setLocale('hi'); expect(store.getState().locale).toBe('hi'); expect(store.getState().preferencesRemembered).toBe(false);
  const unavailable = createUiStore(null); unavailable.getState().dismissWelcome(); expect(unavailable.getState().onboardingSeen).toBe(true); expect(unavailable.getState().preferencesRemembered).toBe(false);
});
