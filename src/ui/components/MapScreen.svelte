<script lang="ts">
  import { onMount } from 'svelte';
  import { addCells } from '../../data/cell-store';
  import { db } from '../../data/db';
  import { LOCATE_MAX_ACCURACY_M } from '../../domain/config';
  import { moveMode } from '../../domain/speed-mode';
  import { discoveryRadiusM } from '../../domain/discovery';
  import { startZoneCells } from '../../domain/start-zone';
  import { MapView, WebGL2RequiredError } from '../../map/map-view';
  import { createPositionSource, PositionError } from '../../platform/position';
  import type { Recorder } from '../../recording/recorder.svelte';
  import { isDark, settings } from '../state/settings.svelte';
  import { ui } from '../state/ui.svelte';
  import { S } from '../i18n/i18n.svelte';
  import Icon from './Icon.svelte';

  let {
    recorder,
    onPermissionDenied,
    onApproximate,
    retryToken,
  }: {
    recorder: Recorder;
    onPermissionDenied: () => void;
    onApproximate: () => void;
    retryToken: number;
  } = $props();
  let container: HTMLDivElement | undefined = $state();
  let webglMissing = $state(false);
  let locating = $state(false);
  let locateFailed = $state(false);
  /** Précision (m) de la dernière position trop imprécise pour gratter. */
  let locateAccuracy = $state<number | null>(null);
  // Enregistrement en cours sans aucune cellule : la précision reçue est probablement en cause.
  const impreciseM = $derived(
    recorder.state === 'recording' &&
      recorder.cellsAdded === 0 &&
      recorder.lastFix &&
      recorder.lastFix.accuracy > LOCATE_MAX_ACCURACY_M
      ? Math.round(recorder.lastFix.accuracy)
      : locateAccuracy,
  );
  let view = $state.raw<MapView | null>(null);
  let drawing = $state(false);

  const positionSource = createPositionSource();

  const currentAppearance = () => ({
    style: settings.mapStyle,
    customStyleUrl: settings.customStyleUrl,
    dark: isDark(),
  });

  $effect(() => {
    view?.setAppearance(currentAppearance());
  });

  $effect(() => {
    view?.fog.setHidden(ui.stylePreview);
  });

  // Mode dessin : l'arrêt (nouveau clic ou démontage) écrit les dernières cellules.
  $effect(() => {
    if (!view || !drawing) return;
    const stop = view.startDrawing((cells) => addCells(db, cells));
    return () => void stop();
  });

  $effect(() => {
    view?.setPinLabels(S.pinLabels);
  });

  onMount(() => {
    if (!container) return;
    try {
      view = new MapView(container, currentAppearance());
    } catch (error) {
      if (error instanceof WebGL2RequiredError) {
        webglMissing = true;
        return;
      }
      throw error;
    }
    if (import.meta.env.MODE === 'bench') {
      const current = view;
      void import('../../dev/dev-hooks').then((m) => m.installDevHooks(current));
    }
    // À l'ouverture et au retour au premier plan : position fraîche et écran recentré dessus, sans
    // indicateur ni fenêtre en cas d'échec (le bouton « Me localiser » reste là pour ça).
    void locate(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !drawing) void locate(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      view?.destroy();
    };
  });

  // Pendant l'enregistrement, le marqueur suit la position sans déplacer la caméra.
  $effect(() => {
    const fix = recorder.lastFix;
    if (fix) view?.setPosition(fix.lng, fix.lat, moveMode(recorder.speedMps));
  });

  // « Réessayer » depuis la fenêtre de localisation approximative.
  let lastRetry = 0;
  $effect(() => {
    if (retryToken !== lastRetry) {
      lastRetry = retryToken;
      void locate();
    }
  });

  /** Localisation automatique en cours (ouverture, retour au premier plan) : jamais deux à la fois. */
  let autoLocating = false;

  /** `manual` : clic sur « Me localiser » (indicateur, erreurs et fenêtre de refus affichés). */
  async function locate(manual = true) {
    if (manual ? locating : autoLocating) return;
    if (manual) {
      locateFailed = false;
      locateAccuracy = null;
      locating = true;
    } else {
      autoLocating = true;
    }
    try {
      const fix = await positionSource.getCurrent();
      if (manual || !drawing) view?.showPosition(fix.lng, fix.lat);
      // Dévoile une petite zone autour de la position, sans attendre un déplacement.
      if (fix.accuracy <= LOCATE_MAX_ACCURACY_M) {
        locateAccuracy = null;
        await addCells(db, startZoneCells(fix.lat, fix.lng, discoveryRadiusM('idle')));
      } else {
        locateAccuracy = Math.round(fix.accuracy);
      }
    } catch (error) {
      if (!manual) return;
      if (error instanceof PositionError && error.status === 'denied') onPermissionDenied();
      else locateFailed = true;
    } finally {
      if (manual) locating = false;
      else autoLocating = false;
    }
  }
</script>

{#if webglMissing}
  <div class="webgl" role="alert" data-testid="webgl-required">
    <h1>{S.webglTitle}</h1>
    <p>{S.webglBody}</p>
  </div>
{:else}
  <div class="map" bind:this={container} data-testid="map"></div>
  <button
    type="button"
    class="round locate"
    onclick={() => locate()}
    disabled={locating}
    aria-label={S.locate}
    title={S.locate}
  >
    <Icon name="locate" size={26} />
  </button>
  <button
    type="button"
    class="round draw"
    class:active={drawing}
    onclick={() => (drawing = !drawing)}
    aria-pressed={drawing}
    aria-label={S.draw}
    title={S.draw}
    data-testid="draw-toggle"
  >
    <Icon name="pencil" size={24} />
  </button>
  <p class="status" role="status">
    {#if locating}{S.locating}{:else if impreciseM !== null}
      {S.locateTooImprecise(impreciseM)}
      <button type="button" class="link" onclick={onApproximate}>{S.locateHowTo}</button>
    {:else if locateFailed}{S.locateUnavailable}{/if}
  </p>
{/if}

<style>
  .map {
    position: fixed;
    inset: 0 0 calc(76px + env(safe-area-inset-bottom)) 0;
  }

  .locate {
    position: fixed;
    right: 12px;
    bottom: calc(96px + env(safe-area-inset-bottom) + 28px);
    z-index: 5;
  }

  .locate:disabled {
    color: var(--accent);
  }

  .draw {
    position: fixed;
    right: 12px;
    bottom: calc(96px + env(safe-area-inset-bottom) + 28px + 48px + 10px);
    z-index: 5;
  }

  .draw.active {
    background: var(--accent);
    color: var(--accent-fg);
    border-color: var(--accent);
  }

  .status {
    position: fixed;
    left: 12px;
    top: calc(12px + env(safe-area-inset-top));
    margin: 0;
    z-index: 5;
    color: var(--fg);
  }

  .status {
    max-width: min(26rem, calc(100vw - 24px));
    padding: 6px 10px;
    border-radius: 10px;
    background: var(--surface);
    border: 1px solid var(--border);
  }

  .link {
    display: inline;
    min-height: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    text-decoration: underline;
  }

  .status:empty {
    display: none;
  }

  .webgl {
    padding: calc(24px + env(safe-area-inset-top)) 20px;
    max-width: 36rem;
    margin: 0 auto;
  }
</style>
