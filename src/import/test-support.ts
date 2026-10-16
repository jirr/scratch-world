import type { Parser, TrackBatch } from './types';

const raw = import.meta.glob<string>('../../tests/fixtures/import/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Contenu texte d'un fichier de tests/fixtures/import. */
export function fixtureText(name: string): string {
  const text = raw[`../../tests/fixtures/import/${name}`];
  if (text === undefined) throw new Error(`fixture inconnue : ${name}`);
  return text;
}

export function fixture(name: string): File {
  return new File([fixtureText(name)], name);
}

export async function collect(parser: Parser, file: Blob): Promise<TrackBatch[]> {
  const batches: TrackBatch[] = [];
  for await (const batch of parser(file, () => {})) batches.push(batch);
  return batches;
}

export const allPoints = (batches: TrackBatch[]) => batches.flatMap((b) => b.points);
