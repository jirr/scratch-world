<script lang="ts">
  import { onMount } from 'svelte';
  import { addCells } from '../../data/cell-store';
  import { db } from '../../data/db';
  import { LOCATE_MAX_ACCURACY_M } from '../../domain/config';
  import { startZoneCells } from '../../domain/start-zone';
  import { MapView, WebGL2RequiredError } from '../../map/map-view';
  import { createPositionSource, PositionError } from '../../platform/position';
  import type { Recorder } from '../../recording/recorder.svelte';
  import { isDark, settings } from '../state/settings.svelte';
  import { S } from '../strings';

  let { recorder, onPermissionDenied }: { recorder: Recorder; onPermissionDenied: () => void } =
    $props();
  let container: HTMLDivElement | undefined = $state();
  let webglMissing = $state(false);
  let locating = $state(false);
  let locateError = $state<string | null>(null);
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
    if (fix) view?.setPosition(fix.lng, fix.lat);
  });

  async function locate() {
    locateError = null;
    locating = true;
    try {
      const fix = await positionSource.getCurrent();
      view?.showPosition(fix.lng, fix.lat);
      // Dévoile une petite zone autour de la position, sans attendre un déplacement.
      if (fix.accuracy <= LOCATE_MAX_ACCURACY_M) {
        await addCells(db, startZoneCells(fix.lat, fix.lng));
      } else {
        locateError = S.locateTooImprecise(Math.round(fix.accuracy));
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
    {#if locating}{S.locating}{:else if locateError}{locateError}{/if}
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
    top: calc(56px + env(safe-area-inset-top));
    margin: 0;
    z-index: 5;
    color: var(--fg);
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
