export const storageState = $state<{ persisted: boolean | null }>({ persisted: null });

/** Demande un stockage persistant (évite l'éviction par le navigateur) et mémorise le résultat. */
export async function ensurePersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) {
    storageState.persisted = false;
    return false;
  }
  try {
    storageState.persisted =
      (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    storageState.persisted = false;
  }
  return storageState.persisted;
}
