import { mkdir, copyFile, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files = ['index.html', 'style.css', 'game.js', 'engine.js', 'audio.js'];
const sources = await Promise.all(files.map(file => readFile(file, 'utf8')));
const version = createHash('sha256').update(sources.join('')).digest('hex').slice(0, 10);
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (let i=0; i<files.length; i++) {
  let content = sources[i];
  for (const entry of ['style.css', 'game.js', 'engine.js', 'audio.js']) content = content.replaceAll(`./${entry}`, `./${entry}?v=${version}`);
  await writeFile(`dist/${files[i]}`, content);
}
await copyFile('favicon.svg', 'dist/favicon.svg');
await cp('assets', 'dist/assets', { recursive: true });
console.log(`Static build ready in dist/ · asset version ${version}`);
