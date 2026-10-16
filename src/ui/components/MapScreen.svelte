<script lang="ts">
  import { onMount } from 'svelte';
  import { addCells } from '../../data/cell-store';
  import { db } from '../../data/db';
  import { LOCATE_MAX_ACCURACY_M } from '../../domain/config';
  import { moveMode } from '../../domain/speed-mode';
  import { startZoneCells } from '../../domain/start-zone';
  import { MapView, WebGL2RequiredError } from '../../map/map-view';
  import { createPositionSource, PositionError } from '../../platform/position';
  import type { Recorder } from '../../recording/recorder.svelte';
  import { isDark, settings } from '../state/settings.svelte';
  import { S } from '../strings';

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
  let locateError = $state<string | null>(null);
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

  const positionSource = createPositionSource();

  const currentAppearance = () => ({
    style: settings.mapStyle,
    customStyleUrl: settings.customStyleUrl,
    dark: isDark(),
  });

  $effect(() => {
    view?.setAppearance(currentAppearance());
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
    return () => view?.destroy();
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

  async function locate() {
    locateError = null;
    locateAccuracy = null;
    locating = true;
    try {
      const fix = await positionSource.getCurrent();
      view?.showPosition(fix.lng, fix.lat);
      // Dévoile une petite zone autour de la position, sans attendre un déplacement.
      if (fix.accuracy <= LOCATE_MAX_ACCURACY_M) {
        await addCells(db, startZoneCells(fix.lat, fix.lng));
      } else {
        locateAccuracy = Math.round(fix.accuracy);
      }
    } catch (error) {
      if (error instanceof PositionError && error.status === 'denied') onPermissionDenied();
      else locateError = S.locateUnavailable;
    } finally {
      locating = false;
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
    class="locate"
    onclick={locate}
    disabled={locating}
    aria-label={S.locate}
    title={S.locate}
  >
    ◎
  </button>
  <p class="status" role="status">
    {#if locating}{S.locating}{:else if impreciseM !== null}
      {S.locateTooImprecise(impreciseM)}
      <button type="button" class="link" onclick={onApproximate}>{S.locateHowTo}</button>
    {:else if locateError}{locateError}{/if}
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
    width: 48px;
    height: 48px;
    border-radius: 50%;
    font-size: 1.4rem;
    z-index: 5;
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
