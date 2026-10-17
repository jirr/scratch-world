<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  /** Section dépliable : titre cliquable avec chevron (`<details>` natif, accessible au clavier). */
  let {
    title,
    open = $bindable(false),
    testid,
    aside,
    children,
  }: {
    title: string;
    open?: boolean;
    testid?: string;
    /** Contenu affiché à droite du titre (compteur, pourcentage…). */
    aside?: Snippet;
    children: Snippet;
  } = $props();
</script>

<details class="section" bind:open data-testid={testid}>
  <summary>
    <span class="chevron"><Icon name="chevron" size={18} /></span>
    <span class="title">{title}</span>
    {#if aside}<span class="aside">{@render aside()}</span>{/if}
  </summary>
  <div class="body">{@render children()}</div>
</details>

<style>
  .section {
    border-top: 1px solid var(--border);
  }

  summary {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 4px 0;
    cursor: pointer;
    list-style: none;
    font-weight: 600;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  .chevron {
    display: flex;
    color: var(--muted, currentColor);
    transition: transform 0.15s ease;
  }

  .section[open] > summary .chevron {
    transform: rotate(90deg);
  }

  .title {
    flex: 1;
    min-width: 0;
  }

  .aside {
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .body {
    padding: 0 0 12px 26px;
  }

  @media (prefers-reduced-motion: reduce) {
    .chevron {
      transition: none;
    }
  }
</style>
