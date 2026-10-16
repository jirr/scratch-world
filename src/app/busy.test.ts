import { describe, expect, it } from 'vitest';
import { acquireBusy, busy } from './busy.svelte';

describe('busy registry', () => {
  it('est occupé tant qu’une opération est en cours, par raison', () => {
    expect(busy.isBusy).toBe(false);
    const releaseImport = acquireBusy('import');
    const releaseRecording = acquireBusy('recording');
    expect(busy.reasons).toEqual(['import', 'recording']);
    releaseImport();
    expect(busy.isBusy).toBe(true);
    releaseRecording();
    expect(busy.isBusy).toBe(false);
  });

  it('compte les acquisitions multiples d’une même raison', () => {
    const first = acquireBusy('import');
    const second = acquireBusy('import');
    first();
    expect(busy.isBusy).toBe(true);
    second();
    expect(busy.isBusy).toBe(false);
  });

  it('ignore un second relâchement du même jeton', () => {
    const first = acquireBusy('restore');
    const second = acquireBusy('restore');
    first();
    first();
    expect(busy.isBusy).toBe(true);
    second();
    expect(busy.isBusy).toBe(false);
  });
});
