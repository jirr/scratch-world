const PAUSED_KEY = 'sw:paused';

/** L'enregistrement démarre tout seul à l'ouverture, sauf si l'utilisateur l'a mis en pause. */
export const recordingPref = $state({
  paused: (typeof localStorage === 'undefined' ? null : localStorage.getItem(PAUSED_KEY)) === '1',
});

export function setPaused(paused: boolean): void {
  recordingPref.paused = paused;
  localStorage.setItem(PAUSED_KEY, paused ? '1' : '0');
}
