import type { SettingKey } from '../data/settings-store';

export type DataEvent =
  | { type: 'cells-changed'; chunks: string[] }
  | { type: 'cells-reset' }
  | { type: 'settings-changed'; key: SettingKey };

const CHANNEL_NAME = 'scratch-world:data';
const EVENT_NAME = 'data';

const local = new EventTarget();
let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel {
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    // Ne retient pas la boucle d'événements (Node/tests) ; sans effet dans un navigateur.
    (channel as { unref?: () => void }).unref?.();
  }
  return channel;
}

/** Diffuse aux autres contextes (BroadcastChannel) et au contexte courant (BroadcastChannel ne s'auto-livre pas). */
export function emitDataEvent(event: DataEvent): void {
  local.dispatchEvent(new CustomEvent<DataEvent>(EVENT_NAME, { detail: event }));
  getChannel().postMessage(event);
}

export function onDataEvent(listener: (event: DataEvent) => void): () => void {
  const onLocal = (e: Event) => listener((e as CustomEvent<DataEvent>).detail);
  const onRemote = (e: MessageEvent<DataEvent>) => listener(e.data);
  const remote = getChannel();
  local.addEventListener(EVENT_NAME, onLocal);
  remote.addEventListener('message', onRemote);
  return () => {
    local.removeEventListener(EVENT_NAME, onLocal);
    remote.removeEventListener('message', onRemote);
  };
}
