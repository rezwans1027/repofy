import { writeFile } from 'node:fs/promises';
import { extractedAggregation, aggregationFiles } from '../../tests/helpers/aggregation-fixtures';

// Fresh observations from fixed invented source, using the actual current
// ingestion/extraction profiles. Never relabel historical reviewed evidence.
async function prepare() {
  const destination = process.argv[2];
  if (!destination) throw new Error('Missing synthetic fixture destination');
  const { input } = await extractedAggregation(aggregationFiles);
  await writeFile(destination, JSON.stringify(input), { flag: 'wx', mode: 0o600 });
}
void prepare().catch(() => { console.error('Synthetic aggregation fixture preparation failed'); process.exitCode = 1; });
