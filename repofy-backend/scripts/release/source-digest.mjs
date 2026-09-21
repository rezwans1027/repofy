import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export async function implementationDigest() {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
      const name = join(directory, entry.name);
      if (entry.isDirectory()) await visit(name);
      else if (entry.isFile() && /\.(?:[cm]?[jt]sx?|json|sql|ya?ml)$/.test(name)) files.push(name);
    }
  }
  for (const directory of ['.github/workflows','packages/contracts/src','repofy-backend/src','repofy-backend/tests','repofy-backend/scripts',
    'repofy-frontend/src','repofy-frontend/e2e','supabase/migrations']) await visit(directory);
  for (const directory of ['packages/contracts','repofy-backend','repofy-frontend']) {
    for (const entry of await readdir(join(root,directory))) if (/^(?:package(?:-lock)?\.json|tsconfig.*\.json|(?:vitest|playwright|next).*\.(?:[cm]?[jt]s))$/.test(entry)) files.push(join(directory,entry));
  }
  files.push('supabase/history.json');
  const hash = createHash('sha256');
  for (const file of files.sort()) hash.update(`${relative(root,join(root,file))}:${createHash('sha256').update(await readFile(join(root,file))).digest('hex')}\n`);
  return hash.digest('hex');
}
