export type BusyReason = 'import' | 'recording' | 'restore';

const counts = $state<Record<BusyReason, number>>({ import: 0, recording: 0, restore: 0 });

/** État réactif : vrai tant qu'au moins une opération longue est en cours. */
export const busy = {
  get isBusy(): boolean {
    return counts.import + counts.recording + counts.restore > 0;
  },
  get reasons(): BusyReason[] {
    return (Object.keys(counts) as BusyReason[]).filter((reason) => counts[reason] > 0);
  },
};

/** Déclare une opération en cours ; l'appelant DOIT appeler la fonction retournée à la fin. */
export function acquireBusy(reason: BusyReason): () => void {
  counts[reason]++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    counts[reason]--;
  };
}
