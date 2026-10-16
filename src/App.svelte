<script lang="ts">
  import { ensurePersistentStorage } from './platform/storage-persist.svelte';
  import BottomBar from './ui/components/BottomBar.svelte';
  import MapScreen from './ui/components/MapScreen.svelte';
  import MenuPanel from './ui/components/MenuPanel.svelte';
  import UpdateToast from './ui/components/UpdateToast.svelte';

  let menuOpen = $state(false);

  void ensurePersistentStorage();
</script>

<MapScreen />
<BottomBar onMenu={() => (menuOpen = true)} />
<MenuPanel open={menuOpen} onClose={() => (menuOpen = false)} />
<UpdateToast />
