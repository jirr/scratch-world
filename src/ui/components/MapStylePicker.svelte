<script lang="ts">
  import { isValidStyleUrl, type StyleChoice } from '../../map/styles';
  import { changeSetting, settings } from '../state/settings.svelte';
  import { ui } from '../state/ui.svelte';
  import { S } from '../i18n/i18n.svelte';
  import Icon from './Icon.svelte';

  let open = $state(false);
  const panelId = $props.id();

  /** Aperçu simplifié de chaque style : fond et couleur d'eau. */
  const SWATCHES: Record<StyleChoice, [string, string]> = {
    auto: ['#f1efe9', '#1d2433'],
    liberty: ['#f1efe9', '#a0c8f0'],
    bright: ['#f8f4f0', '#9bc7ef'],
    positron: ['#ebebeb', '#d7dcdf'],
    dark: ['#1b1b1e', '#2f3133'],
    fiord: ['#45516e', '#2f4a6b'],
    custom: ['#ffffff', '#c8c8c8'],
  };

  // Aperçu : le brouillard est masqué tant que le sélecteur est ouvert.
  $effect(() => {
    ui.stylePreview = open;
    return () => (ui.stylePreview = false);
  });

  const choices = Object.keys(S.mapStyles) as StyleChoice[];
  const invalid = $derived(
    settings.mapStyle === 'custom' &&
      settings.customStyleUrl !== '' &&
      !isValidStyleUrl(settings.customStyleUrl),
  );

  function swatch(choice: StyleChoice): string {
    const [a, b] = SWATCHES[choice];
    return `linear-gradient(135deg, ${a} 50%, ${b} 50%)`;
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape') open = false;
  }}
/>

<button
  type="button"
  class="round toggle"
  aria-label={S.mapStyleOpen}
  title={S.mapStyleOpen}
  aria-expanded={open}
  aria-controls={panelId}
  onclick={() => (open = !open)}
>
  <Icon name="layers" />
</button>

{#if open}
  <!-- Panneau non modal : la carte reste visible et réagit tout de suite au choix. -->
  <div
    id={panelId}
    class="panel"
    role="group"
    aria-label={S.mapStyleTitle}
    data-testid="style-picker"
  >
    <p class="title">{S.mapStyleTitle}</p>
    <p class="hint">{S.mapStylePreviewHint}</p>
    <div class="grid">
      {#each choices as choice (choice)}
        <button
          type="button"
          class="choice"
          aria-pressed={settings.mapStyle === choice}
          onclick={() => void changeSetting('mapStyle', choice)}
        >
          <span class="swatch" style:background={swatch(choice)}></span>
          <span>{S.mapStyles[choice]}</span>
        </button>
      {/each}
    </div>
    {#if settings.mapStyle === 'custom'}
      <label class="custom">
        <span>{S.settingsCustomStyle}</span>
        <input
          type="url"
          inputmode="url"
          placeholder="https://…/style.json"
          value={settings.customStyleUrl}
          aria-invalid={invalid}
          onchange={(e) => void changeSetting('customStyleUrl', e.currentTarget.value.trim())}
        />
        {#if invalid}<small class="error" role="alert">{S.settingsCustomStyleInvalid}</small>{/if}
      </label>
    {/if}
    <button type="button" class="close" onclick={() => (open = false)}>{S.close}</button>
  </div>
{/if}

<style>
  .toggle {
    position: fixed;
    right: 12px;
    top: calc(12px + 48px + 10px + env(safe-area-inset-top));
    z-index: 5;
  }

  .toggle[aria-expanded='true'] {
    color: var(--accent);
    border-color: var(--accent);
  }

  .panel {
    position: fixed;
    right: 12px;
    top: calc(12px + 48px + 10px + 48px + 10px + env(safe-area-inset-top));
    width: min(20rem, calc(100vw - 24px));
    max-height: calc(100dvh - 220px);
    overflow: auto;
    padding: 12px;
    border-radius: 14px;
    background: var(--surface);
    color: var(--fg);
    border: 1px solid var(--border);
    box-shadow: 0 8px 28px rgb(0 0 0 / 0.35);
    z-index: 30;
  }

  .title {
    margin: 0 0 8px;
    font-weight: 700;
  }

  .hint {
    margin: 0 0 8px;
    font-size: 0.8rem;
    color: var(--muted);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .choice {
    display: grid;
    justify-items: center;
    gap: 4px;
    padding: 6px 4px;
    font-size: 0.8rem;
  }

  .choice[aria-pressed='true'] {
    border-color: var(--accent);
    outline: 2px solid var(--accent);
  }

  .swatch {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    border: 1px solid var(--border);
  }

  .custom {
    display: grid;
    gap: 4px;
    margin-top: 10px;
  }

  .custom input {
    font: inherit;
    padding: 8px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
  }

  .error {
    color: var(--danger-text);
  }

  .close {
    margin-top: 10px;
    width: 100%;
  }
</style>
