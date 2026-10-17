<script lang="ts">
  import type { ImportSession } from '../../app/import-session.svelte';
  import type { ImportResult } from '../../import/pipeline';
  import { S } from '../i18n/i18n.svelte';
  import Section from './Section.svelte';

  /** Section « Importer des données » du menu : dépôt de fichiers, progression, résultats. */
  let { session }: { session: ImportSession } = $props();
  let dragging = $state(false);

  function start(list: FileList | null) {
    if (list && list.length > 0) void session.run([...list]);
  }

  function describe(result: ImportResult): string {
    if (result.status === 'imported') return S.importAdded(result.cellsAdded);
    if (result.status === 'error') return S.importError(result.message);
    return S.importStatus[result.status];
  }

  const percent = $derived(session.progress ? Math.round(session.progress.ratio * 100) : 0);
</script>

<Section title={S.importTitle} testid="import-section">
  {#if session.state === 'running'}
    <p data-testid="import-file">
      {session.progress?.fileName ?? ''}
      {#if session.progress}({session.progress.fileIndex + 1}/{session.progress.fileCount}){/if}
    </p>
    <p class="muted">
      {session.progress ? S.importPhases[session.progress.phase] : S.importProgress}
    </p>
    <progress
      max="100"
      value={percent}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={percent}
      aria-label={S.importProgress}
    ></progress>
    <p class="actions">
      <button type="button" onclick={() => session.cancel()}>{S.importCancel}</button>
    </p>
  {:else if session.state === 'done'}
    {#if session.failed}<p role="alert">{S.importFailed}</p>{/if}
    <ul class="results" data-testid="import-results">
      {#each session.results as result (result.fileName)}
        <li class={result.status}>
          <strong>{result.fileName}</strong>
          <span>{describe(result)}</span>
        </li>
      {/each}
    </ul>
    <p class="actions">
      <button type="button" onclick={() => session.reset()}>{S.importAgain}</button>
    </p>
  {:else}
    <p>{S.importBody}</p>
    <div
      class="drop"
      class:dragging
      role="presentation"
      ondragover={(e) => {
        e.preventDefault();
        dragging = true;
      }}
      ondragleave={() => (dragging = false)}
      ondrop={(e) => {
        e.preventDefault();
        dragging = false;
        start(e.dataTransfer?.files ?? null);
      }}
    >
      <label class="choose">
        <span class="primary-label">{S.importChoose}</span>
        <input
          type="file"
          multiple
          data-testid="import-input"
          onchange={(e) => {
            start(e.currentTarget.files);
            e.currentTarget.value = '';
          }}
        />
      </label>
      <span class="muted">{S.importDrop}</span>
    </div>
  {/if}
</Section>

<style>
  progress {
    width: 100%;
    height: 14px;
  }

  .muted {
    color: var(--muted);
  }

  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .drop {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px;
    border: 2px dashed var(--border);
    border-radius: 12px;
  }

  .drop.dragging {
    border-color: var(--accent);
  }

  .choose {
    cursor: pointer;
  }

  .primary-label {
    display: inline-block;
    padding: 10px 16px;
    border-radius: 10px;
    background: var(--accent);
    color: var(--accent-fg);
    font-weight: 600;
  }

  .choose:focus-within .primary-label {
    outline: 3px solid var(--fg);
    outline-offset: 2px;
  }

  /* Le champ reste dans l'arbre d'accessibilité mais visuellement masqué. */
  input[type='file'] {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    overflow: hidden;
  }

  .results {
    list-style: none;
    padding: 0;
    margin: 0 0 12px;
    display: grid;
    gap: 8px;
  }

  .results li {
    display: flex;
    flex-direction: column;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .results .error span,
  .results .unsupported span,
  .results .too-large span {
    color: var(--danger-text);
  }
</style>
