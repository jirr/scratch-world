import { emitDataEvent } from '../app/data-events';
import type { ScratchDb } from './db';

export interface Settings {
  accuracyThresholdM: number;
  keepRawTracks: boolean;
  mapStyle: 'auto' | 'liberty' | 'bright' | 'positron' | 'dark' | 'fiord' | 'custom';
  customStyleUrl: string;
  theme: 'system' | 'light' | 'dark';
  /** 'system' : langue du navigateur (français ou anglais, sinon anglais). */
  language: 'system' | 'fr' | 'en';
  wakeLockDefault: boolean;
}

export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Settings = {
  accuracyThresholdM: 50,
  keepRawTracks: false,
  mapStyle: 'auto',
  customStyleUrl: '',
  theme: 'system',
  language: 'system',
  wakeLockDefault: false,
};

export async function getSetting<K extends SettingKey>(
  db: ScratchDb,
  key: K,
): Promise<Settings[K]> {
  const row = await db.settings.get(key);
  return row ? (row.value as Settings[K]) : DEFAULT_SETTINGS[key];
}

export async function setSetting<K extends SettingKey>(
  db: ScratchDb,
  key: K,
  value: Settings[K],
): Promise<void> {
  await db.settings.put({ key, value });
  emitDataEvent({ type: 'settings-changed', key });
}
