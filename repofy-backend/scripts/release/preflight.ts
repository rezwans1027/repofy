// Read only the local configuration. Emit allowlisted booleans/counts, never values
// of secrets, user IDs, account names, database addresses or provider responses.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { MODEL } from '../../src/domain/synthesis/policy';

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
async function main() {
  let local: Record<string,string> = {};
  try { local = parse(await readFile(resolve(backend, '.env'))); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const env = { ...local, ...process.env };
  const flags = ['FEATURE_ONE_ENABLED','GITHUB_APP_REPOSITORIES_ENABLED','FEATURE_ONE_SYNTHESIS_ENABLED','RESCANS_ENABLED','FINDING_FEEDBACK_ENABLED','FEATURE_ONE_PROVENANCE_ENABLED'];
  const present = (name: string) => Boolean(env[name]?.trim() && !/^<.*>$/.test(env[name]!.trim()));
  const result = { checkedAt: new Date().toISOString(), scope: 'local_configuration_only', remoteDeploymentVerified: false,
    flags: Object.fromEntries(flags.map(name => [name, { value: env[name] === 'true' ? true : env[name] === undefined || env[name] === 'false' ? false : 'invalid',
      source: process.env[name] !== undefined ? 'process_environment' : local[name] !== undefined ? 'local_env_file' : 'disabled_default' }])),
    allowlistEntries: (env.FEATURE_ONE_ANALYSIS_ALLOWLIST ?? '').split(',').filter(s => s.trim()).length,
    credentialsPresent: Object.fromEntries(['GITHUB_APP_ID','GITHUB_APP_SLUG','GITHUB_APP_PRIVATE_KEY','GITHUB_APP_WEBHOOK_SECRET','OPENAI_API_KEY'].map(name => [name, present(name)])),
    pinnedModel: MODEL.version, pinnedModelConfigured: env.FEATURE_ONE_MODEL === MODEL.version,
    liveCallsMade: 0, environmentModified: false,
    note: 'Presence does not prove credential validity, scopes, managed storage, retention acceptance or provider availability' };
  if (process.argv.includes('--record')) await writeFile(resolve(backend,'../docs/benchmarks/run16-preflight.json'), JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}
void main().catch(() => { console.error('Local release preflight could not read configuration safely'); process.exitCode = 1; });
