<script lang="ts" module>
  export type IconName =
    'locate' | 'layers' | 'refresh' | 'stats' | 'import' | 'menu' | 'play' | 'pause' | 'close';

  /** Tracé d'icône sur une grille 24×24 ; `fill` : forme pleine (sinon trait seul). */
  interface Shape {
    d: string;
    fill?: boolean;
  }

  const ICONS: Record<IconName, Shape[]> = {
    locate: [
      { d: 'M12 5a7 7 0 1 0 0 14a7 7 0 1 0 0-14z' },
      { d: 'M12 2v3M12 19v3M2 12h3M19 12h3' },
      { d: 'M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z', fill: true },
    ],
    layers: [
      { d: 'M12 2.5L2 7.5l10 5l10-5z' },
      { d: 'M2 12l10 5l10-5' },
      { d: 'M2 16.5l10 5l10-5' },
    ],
    refresh: [{ d: 'M20 12a8 8 0 1 1-2.34-5.66L20 9' }, { d: 'M20 4v5h-5' }],
    stats: [{ d: 'M4 20h16' }, { d: 'M7 16v-5M12 16V6M17 16V9' }],
    import: [
      { d: 'M12 4v11' },
      { d: 'M7.5 10.5L12 15l4.5-4.5' },
      { d: 'M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3' },
    ],
    menu: [{ d: 'M4 6h16M4 12h16M4 18h16' }],
    play: [{ d: 'M7 4.5v15l13-7.5z', fill: true }],
    pause: [{ d: 'M7 5h3v14H7zM14 5h3v14h-3z', fill: true }],
    close: [{ d: 'M6 6l12 12M18 6L6 18' }],
  };
</script>

<script lang="ts">
  let { name, size = 24 }: { name: IconName; size?: number } = $props();
</script>

<!-- Décorative : le libellé accessible est porté par le bouton ou le texte voisin. -->
<svg
  class="icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  aria-hidden="true"
  focusable="false"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  {#each ICONS[name] as shape (shape.d)}
    <path d={shape.d} fill={shape.fill ? 'currentColor' : 'none'} />
  {/each}
</svg>

<style>
  .icon {
    display: block;
    flex: none;
  }
</style>
