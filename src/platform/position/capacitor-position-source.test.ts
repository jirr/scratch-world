import type {
  BackgroundGeolocationPlugin,
  CallbackError,
  Location,
  StartOptions,
} from '@capgo/background-geolocation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CapacitorPositionSource } from './capacitor-position-source';
import type { PositionFix, PositionStatus } from './position-source';

type Callback = (location?: Location, error?: CallbackError) => void;

/** Le plugin natif : un seul flux à la fois, comme le vrai (`start` puis `stop`). */
class FakePlugin {
  starts: StartOptions[] = [];
  calls: string[] = [];
  /** Rappel de chaque démarrage, dans l'ordre. */
  callbacks: Callback[] = [];

  async start(options: StartOptions, callback: Callback) {
    this.starts.push(options);
    this.calls.push('start');
    this.callbacks.push(callback);
  }

  async stop() {
    this.calls.push('stop');
  }

  emit(accuracy: number | null, callback = this.callbacks.at(-1)) {
    callback?.({
      latitude: 48.85,
      longitude: 2.35,
      accuracy: accuracy as number,
      altitude: null,
      altitudeAccuracy: null,
      simulated: false,
      bearing: null,
      speed: 1.2,
      time: 1_000,
    });
  }

  fail(code: string) {
    this.callbacks.at(-1)?.(undefined, Object.assign(new Error(code), { code }));
  }
}

const notice = { title: 'Titre', message: 'Message' };
let plugin: FakePlugin;
let source: CapacitorPositionSource;
let fixes: PositionFix[];
let statuses: PositionStatus[];

function track() {
  return source.start(
    (fix) => fixes.push(fix),
    (status) => statuses.push(status),
  );
}

beforeEach(() => {
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
  plugin = new FakePlugin();
  source = new CapacitorPositionSource(
    () => notice,
    plugin as unknown as BackgroundGeolocationPlugin,
  );
  fixes = [];
  statuses = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CapacitorPositionSource', () => {
  it('suit la position en arrière-plan pendant l’enregistrement, puis arrête le plugin', async () => {
    await track();
    expect(plugin.starts).toEqual([
      expect.objectContaining({ backgroundTitle: 'Titre', backgroundMessage: 'Message' }),
    ]);
    plugin.emit(12);
    expect(fixes).toEqual([{ lat: 48.85, lng: 2.35, accuracy: 12, timestamp: 1_000, speed: 1.2 }]);
    expect(statuses.at(-1)).toBe('active');

    await source.stop();
    expect(plugin.calls.at(-1)).toBe('stop');
  });

  it('« Me localiser » partage le flux de l’enregistrement sans relancer le plugin', async () => {
    await track();
    const current = source.getCurrent();
    plugin.emit(15);
    await expect(current).resolves.toMatchObject({ accuracy: 15 });
    await vi.waitFor(() => expect(plugin.calls).toEqual(['stop', 'start']));
    expect(fixes).toHaveLength(1);
  });

  it('un enregistrement démarré pendant « Me localiser » relance le plugin en arrière-plan', async () => {
    const current = source.getCurrent();
    await vi.waitFor(() => expect(plugin.starts).toHaveLength(1));
    await track();
    expect(plugin.calls).toEqual(['stop', 'start', 'stop', 'start']);
    expect(plugin.starts.at(-1)).toHaveProperty('backgroundMessage', 'Message');
    // La session de premier plan, arrêtée, ne délivre plus rien.
    plugin.emit(10, plugin.callbacks[0]);
    expect(fixes).toEqual([]);
    plugin.emit(10);
    expect(fixes).toHaveLength(1);
    await expect(current).resolves.toMatchObject({ accuracy: 10 });
  });

  it('un refus est signalé à l’enregistrement et fait échouer « Me localiser »', async () => {
    await track();
    const current = source.getCurrent();
    plugin.fail('NOT_AUTHORIZED');
    expect(statuses.at(-1)).toBe('denied');
    await expect(current).rejects.toMatchObject({ status: 'denied' });
  });

  it('ignore une position sans précision exploitable', async () => {
    await track();
    plugin.emit(null);
    plugin.emit(-1);
    expect(fixes).toEqual([]);
  });

  it('relance le suivi au retour au premier plan après une erreur', async () => {
    await track();
    plugin.fail('FOREGROUND_SERVICE_START_NOT_ALLOWED');
    expect(statuses.at(-1)).toBe('unavailable');

    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(plugin.starts).toHaveLength(2));
    plugin.emit(8);
    expect(fixes).toHaveLength(1);
    expect(statuses.at(-1)).toBe('active');
  });
});
