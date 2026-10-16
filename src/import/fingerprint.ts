const MIB = 1024 * 1024;

/** SHA-256(premier Mio ‖ dernier Mio ‖ taille) : identifie un fichier sans le relire en entier. */
export async function fingerprintFile(file: Blob): Promise<string> {
  const head = await file.slice(0, MIB).arrayBuffer();
  const tail = await file.slice(Math.max(0, file.size - MIB)).arrayBuffer();
  const size = new TextEncoder().encode(String(file.size));
  const data = new Uint8Array(head.byteLength + tail.byteLength + size.byteLength);
  data.set(new Uint8Array(head), 0);
  data.set(new Uint8Array(tail), head.byteLength);
  data.set(size, head.byteLength + tail.byteLength);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}
