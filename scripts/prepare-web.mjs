import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webOutput = path.join(projectRoot, 'www');

await mkdir(webOutput, { recursive: true });

for (const file of ['index.html', 'manifest.webmanifest', 'service-worker.js']) {
  await cp(path.join(projectRoot, file), path.join(webOutput, file));
}

for (const directory of ['src', 'styles', 'icons']) {
  await cp(path.join(projectRoot, directory), path.join(webOutput, directory), { recursive: true });
}

console.log(`Radiofy web assets prepared in ${webOutput}`);
