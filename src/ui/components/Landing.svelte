<script lang="ts">
  import { installState, promptInstall } from '../../app/install-service.svelte';
  import { PSEUDO_MAX, PSEUDO_MIN, setPseudo } from '../../app/profile.svelte';
  import { S } from '../i18n/i18n.svelte';

  let value = $state('');
  let invalid = $state(false);

  function submit(event: SubmitEvent) {
    event.preventDefault();
    invalid = !setPseudo(value);
  }
</script>

<main class="landing" data-testid="landing">
  <img src="{import.meta.env.BASE_URL}pwa-192x192.png" alt="" width="96" height="96" />
  <h1>{S.appName}</h1>
  <p class="tagline">{S.landingTagline}</p>
  <p>{S.landingIntro}</p>
  <ul>
    {#each S.landingPoints as point (point)}
      <li>{point}</li>
    {/each}
  </ul>

  <form onsubmit={submit} novalidate>
    <label for="pseudo">{S.landingPseudoLabel}</label>
    <input
      id="pseudo"
      type="text"
      autocomplete="nickname"
      minlength={PSEUDO_MIN}
      maxlength={PSEUDO_MAX}
      bind:value
      aria-describedby="pseudo-hint"
      aria-invalid={invalid}
    />
    <small id="pseudo-hint" class="muted">{S.landingPseudoHint}</small>
    {#if invalid}<small class="error" role="alert">{S.landingPseudoInvalid}</small>{/if}
    <button type="submit" class="primary">{S.landingStart}</button>
  </form>

  <section class="install" aria-labelledby="install-title">
    <h2 id="install-title">{S.landingInstallTitle}</h2>
    {#if installState.canPrompt}
      <button type="button" onclick={() => void promptInstall()}>{S.landingInstallAction}</button>
    {:else if installState.showIosHelp}
      <p>{S.installIosBody}</p>
    {:else}
      <p class="muted">{S.landingInstallNone}</p>
    {/if}
  </section>
</main>

<style>
  .landing {
    max-width: 30rem;
    margin: 0 auto;
    padding: calc(28px + env(safe-area-inset-top)) 20px calc(28px + env(safe-area-inset-bottom));
    display: grid;
    gap: 12px;
    justify-items: start;
  }

  h1 {
    margin: 0;
    font-size: 2rem;
  }

  .tagline {
    margin: 0;
    font-size: 1.15rem;
    color: var(--accent);
    font-weight: 600;
  }

  ul {
    margin: 0;
    padding-left: 1.2rem;
    display: grid;
    gap: 6px;
  }

  form {
    display: grid;
    gap: 6px;
    width: 100%;
    margin-top: 8px;
  }

  input {
    font: inherit;
    padding: 10px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--fg);
  }

  form button {
    margin-top: 6px;
  }

  .install {
    width: 100%;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .install h2 {
    margin: 0 0 8px;
    font-size: 1.05rem;
  }

  .muted {
    color: var(--muted);
  }

  .error {
    color: var(--danger-text);
  }
</style>
