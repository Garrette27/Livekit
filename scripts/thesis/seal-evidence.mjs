import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const dir='docs/testing/evidence/2026-11-17';
const hashes=Object.fromEntries(readdirSync(dir).filter(f=>f!=='sha256.json').sort().map(f=>[f,createHash('sha256').update(readFileSync(`${dir}/${f}`)).digest('hex')]));
writeFileSync(`${dir}/sha256.json`,JSON.stringify(hashes,null,2)+'\n');
console.log({files:Object.keys(hashes).length});
