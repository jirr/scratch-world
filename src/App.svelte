<script lang="ts">
  import { VERSION_LABEL } from './app/build-info';
  import { checkForUpdate, type UpdateCheckResult } from './app/update-service.svelte';
  import { S } from './ui/strings';
  import UpdateToast from './ui/components/UpdateToast.svelte';

  const messages: Record<UpdateCheckResult, string> = {
    found: S.updateFound,
    'up-to-date': S.updateNone,
    unavailable: S.updateUnavailable,
  };

  let checking = $state(false);
  let result = $state<UpdateCheckResult | null>(null);

  async function onCheck() {
    checking = true;
    result = null;
    result = await checkForUpdate();
    checking = false;
  }
</script>

<main>
  <h1>{S.appName}</h1>
  <p class="muted">{S.tagline}</p>
  <p class="muted" data-testid="app-version">{VERSION_LABEL}</p>
  <button type="button" onclick={onCheck} disabled={checking}>
    {checking ? S.updateChecking : S.updateCheck}
  </button>
  {#if result}
    <p data-testid="update-check-result">{messages[result]}</p>
  {/if}
</main>

<UpdateToast />

<style>
  main {
    max-width: 36rem;
    margin: 0 auto;
    padding: calc(24px + env(safe-area-inset-top)) 20px 24px;
  }

  .muted {
    color: var(--muted);
  }
</style>
