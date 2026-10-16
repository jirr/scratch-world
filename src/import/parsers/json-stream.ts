export interface StreamItem {
  /** Nom de la propriété de niveau 1 qui porte le tableau ; `null` si la racine est un tableau. */
  key: string | null;
  item: unknown;
}

const WS = new Set([0x20, 0x09, 0x0a, 0x0d]);
const QUOTE = 0x22;
const BACKSLASH = 0x5c;
const COMMA = 0x2c;
const COLON = 0x3a;
const OPEN_OBJ = 0x7b;
const CLOSE_OBJ = 0x7d;
const OPEN_ARR = 0x5b;
const CLOSE_ARR = 0x5d;

/**
 * Automate caractère par caractère : repère les éléments des tableaux de niveau 1 (ou de la racine
 * si c'est un tableau) et ne parse que chacun d'eux. Mémoire bornée par la taille d'un élément.
 */
class Scanner {
  #depth = 0;
  #inString = false;
  #escaped = false;
  #root: number | null = null;
  #expectKey = false;
  #keyBuf = '';
  #currentKey: string | null = null;
  #arrayDepth = -1;
  #arrayKey: string | null = null;
  #capturing = false;
  #kind = 0;
  #parts: string[] = [];

  constructor(private readonly wanted?: ReadonlySet<string>) {}

  feed(text: string): StreamItem[] {
    const out: StreamItem[] = [];
    let segStart = this.#capturing ? 0 : -1;

    const finish = (end: number) => {
      const raw = this.#parts.join('') + text.slice(segStart, end);
      this.#parts = [];
      this.#capturing = false;
      segStart = -1;
      out.push({ key: this.#arrayKey, item: JSON.parse(raw) });
    };
    const startCapture = (i: number, kind: number) => {
      this.#capturing = true;
      this.#kind = kind;
      segStart = i;
    };

    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);

      if (this.#inString) {
        if (this.#escaped) {
          this.#escaped = false;
          if (this.#expectKey) this.#keyBuf += '\\' + text[i];
        } else if (c === BACKSLASH) {
          this.#escaped = true;
        } else if (c === QUOTE) {
          this.#inString = false;
          if (this.#expectKey && this.#depth === 1 && this.#root === OPEN_OBJ) {
            this.#currentKey = JSON.parse(`"${this.#keyBuf}"`) as string;
            this.#expectKey = false;
          }
          if (this.#capturing && this.#kind === QUOTE && this.#depth === this.#arrayDepth + 1) {
            finish(i + 1);
          }
        } else if (this.#expectKey) {
          this.#keyBuf += text[i];
        }
        continue;
      }

      const inArrayBody = this.#arrayDepth >= 0 && this.#depth === this.#arrayDepth + 1;
      const capturable =
        inArrayBody && (!this.wanted || this.#arrayKey === null || this.wanted.has(this.#arrayKey));

      if (
        this.#capturing &&
        this.#kind === 0x70 &&
        inArrayBody &&
        (c === COMMA || c === CLOSE_ARR)
      ) {
        finish(i);
      }

      if (c === QUOTE) {
        if (!this.#capturing && capturable) startCapture(i, QUOTE);
        this.#inString = true;
        if (this.#depth === 1 && this.#root === OPEN_OBJ && this.#expectKey) this.#keyBuf = '';
        continue;
      }
      if (WS.has(c)) continue;

      if (c === OPEN_OBJ || c === OPEN_ARR) {
        if (this.#depth === 0) {
          this.#root = c;
          if (c === OPEN_ARR) {
            this.#arrayDepth = 0;
            this.#arrayKey = null;
          } else {
            this.#expectKey = true;
          }
        } else if (!this.#capturing && capturable) {
          startCapture(i, c);
        } else if (
          c === OPEN_ARR &&
          this.#depth === 1 &&
          this.#root === OPEN_OBJ &&
          this.#currentKey !== null &&
          this.#arrayDepth < 0
        ) {
          this.#arrayDepth = 1;
          this.#arrayKey = this.#currentKey;
        }
        this.#depth++;
        continue;
      }

      if (c === CLOSE_OBJ || c === CLOSE_ARR) {
        this.#depth--;
        if (
          this.#capturing &&
          (this.#kind === OPEN_OBJ || this.#kind === OPEN_ARR) &&
          this.#depth === this.#arrayDepth + 1
        ) {
          finish(i + 1);
        } else if (c === CLOSE_ARR && this.#depth === this.#arrayDepth) {
          this.#arrayDepth = -1;
          this.#arrayKey = null;
          this.#currentKey = null;
          if (this.#root === OPEN_OBJ) this.#expectKey = false;
        }
        continue;
      }

      if (c === COLON) {
        this.#expectKey = false;
        continue;
      }
      if (c === COMMA) {
        if (this.#depth === 1 && this.#root === OPEN_OBJ) {
          this.#expectKey = true;
          this.#currentKey = null;
        }
        continue;
      }
      // Début d'un littéral (nombre, true, false, null) dans un tableau suivi.
      if (!this.#capturing && capturable) startCapture(i, 0x70);
    }

    if (this.#capturing) this.#parts.push(text.slice(segStart));
    return out;
  }
}

/** Éléments des tableaux de niveau 1, en flux, sans jamais charger le fichier entier. */
export async function* streamTopLevelArrayItems(
  stream: ReadableStream<Uint8Array>,
  onBytes?: (totalRead: number) => void,
  keys?: readonly string[],
): AsyncGenerator<StreamItem> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  const scanner = new Scanner(keys ? new Set(keys) : undefined);
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      yield* scanner.feed(decoder.decode(value, { stream: true }));
      onBytes?.(total);
    }
    yield* scanner.feed(decoder.decode());
  } finally {
    reader.releaseLock();
  }
}
