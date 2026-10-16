import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserPositionSource } from './browser-position-source';

type Ok = (p: GeolocationPosition) => void;
type Fail = (e: GeolocationPositionError) => void;

let ok: Ok = () => {};
let fail: Fail = () => {};
const clearWatch = vi.fn();

const position = (accuracy: number): GeolocationPosition =>
  ({
    coords: { latitude: 48.85, longitude: 2.35, accuracy, speed: null },
    timestamp: 1,
  }) as GeolocationPosition;

beforeEach(() => {
  vi.useFakeTimers();
  clearWatch.mockClear();
  vi.stubGlobal('navigator', {
    geolocation: {
      watchPosition: (success: Ok, error: Fail) => {
        ok = success;
        fail = error;
        return 7;
      },
      clearWatch,
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('BrowserPositionSource.getCurrent', () => {
  it('ignore le fix réseau grossier et rend le fix GPS précis dès qu’il arrive', async () => {
    const promise = new BrowserPositionSource().getCurrent();
    ok(position(4000));
    ok(position(900));
    ok(position(15));
    await expect(promise).resolves.toMatchObject({ accuracy: 15 });
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it('rend la meilleure position reçue si aucune n’est assez bonne avant le délai', async () => {
    const promise = new BrowserPositionSource().getCurrent();
    ok(position(3000));
    ok(position(450));
    ok(position(1200));
    await vi.advanceTimersByTimeAsync(12_000);
    await expect(promise).resolves.toMatchObject({ accuracy: 450 });
    expect(clearWatch).toHaveBeenCalled();
  });

  it('échoue immédiatement si la permission est refusée', async () => {
    const promise = new BrowserPositionSource().getCurrent();
    fail({ code: 1, PERMISSION_DENIED: 1, message: 'denied' } as GeolocationPositionError);
    await expect(promise).rejects.toMatchObject({ status: 'denied' });
  });

  it('échoue après le délai si aucune position n’est reçue', async () => {
    const promise = new BrowserPositionSource().getCurrent();
    const assertion = expect(promise).rejects.toMatchObject({ status: 'unavailable' });
    await vi.advanceTimersByTimeAsync(12_000);
    await assertion;
  });
});
