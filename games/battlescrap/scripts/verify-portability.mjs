import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(readFileSync(resolve(root,'PORTABILITY-MANIFEST.json'),'utf8'));
for(const f of manifest.files){
  const path=resolve(root,f.path);
  if(!existsSync(path))throw Error(`Missing ${f.path}`);
  const bytes=readFileSync(path);
  if(bytes.length!==f.bytes || createHash('sha256').update(bytes).digest('hex')!==f.sha256)throw Error(`Changed ${f.path}`);
}
for(const name of ['package-lock.json','src/engine.ts','START-HERE.md','AGENTS.md'])if(!existsSync(resolve(root,name)))throw Error(`Missing ${name}`);
console.log(`Verified ${manifest.files.length} packaged files against SHA-256 manifest.`);
