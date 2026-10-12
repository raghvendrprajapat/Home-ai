import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { Locale } from '../i18n/messages';
export type Screen = 'editor' | 'projects' | 'settings';
interface Preferences { locale: Locale; units: 'metric' | 'imperial'; onboardingSeen: boolean }
export interface UiState extends Preferences {
  screen: Screen; returnTo: 'editor' | 'projects'; preferencesRemembered: boolean;
  setScreen(screen: Screen): void; setLocale(locale: Locale): void; setUnits(units: Preferences['units']): void; dismissWelcome(): void;
}
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
const preferenceKey = 'gharplan-ui-preferences';
export function createUiStore(storage: PreferenceStorage | null) {
  let preferences: Preferences = { locale: 'en', units: 'metric', onboardingSeen: false }, remembered = !!storage;
  try {
    const text = storage?.getItem(preferenceKey);
    if (text) {
      const value = JSON.parse(text);
      if (value.version !== 1 || !['en', 'hi'].includes(value.locale) || !['metric', 'imperial'].includes(value.units) || typeof value.onboardingSeen !== 'boolean') throw new Error('Invalid preferences.');
      preferences = { locale: value.locale, units: value.units, onboardingSeen: value.onboardingSeen };
    }
  } catch { remembered = false; }
  return createStore<UiState>()((set, get) => {
    const remember = () => {
      const { locale, units, onboardingSeen } = get();
      try { if (!storage) throw new Error('Preference storage unavailable.'); storage.setItem(preferenceKey, JSON.stringify({ version: 1, locale, units, onboardingSeen })); set({ preferencesRemembered: true }); }
      catch { set({ preferencesRemembered: false }); }
    };
    return { ...preferences, preferencesRemembered: remembered, screen: 'editor', returnTo: 'editor',
      setScreen: screen => set(current => ({ screen, returnTo: screen === 'settings' && current.screen !== 'settings' ? current.screen === 'projects' ? 'projects' : 'editor' : current.returnTo })),
      setLocale: locale => { if (!['en', 'hi'].includes(locale)) return; set({ locale }); remember(); },
      setUnits: units => { if (!['metric', 'imperial'].includes(units)) return; set({ units }); remember(); },
      dismissWelcome: () => { set({ onboardingSeen: true }); remember(); },
    };
  });
}
function browserPreferences(): PreferenceStorage | null { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }
export const uiStore = createUiStore(browserPreferences());
export const useUi = () => useStore(uiStore);
