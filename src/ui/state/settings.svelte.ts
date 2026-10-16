import { MediaQuery } from 'svelte/reactivity';
import { onDataEvent } from '../../app/data-events';
import { db } from '../../data/db';
import {
  DEFAULT_SETTINGS,
  getSetting,
  setSetting,
  type SettingKey,
  type Settings,
} from '../../data/settings-store';

/** Réglages réactifs, miroir de la table `settings` (valeurs par défaut avant le premier chargement). */
export const settings = $state<Settings>({ ...DEFAULT_SETTINGS });

const systemDark = new MediaQuery('prefers-color-scheme: dark');

export function isDark(): boolean {
  return settings.theme === 'dark' || (settings.theme === 'system' && systemDark.current);
}

async function load<K extends SettingKey>(key: K): Promise<void> {
  settings[key] = await getSetting(db, key);
}

export async function initSettings(): Promise<() => void> {
  await Promise.all((Object.keys(DEFAULT_SETTINGS) as SettingKey[]).map((key) => load(key)));
  // Un autre onglet peut modifier un réglage.
  return onDataEvent((event) => {
    if (event.type === 'settings-changed') void load(event.key);
  });
}

export async function changeSetting<K extends SettingKey>(
  key: K,
  value: Settings[K],
): Promise<void> {
  settings[key] = value;
  await setSetting(db, key, value);
}
