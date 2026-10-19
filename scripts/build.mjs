import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist/soundboard', { recursive: true });
await cp('public', 'dist/soundboard', { recursive: true });
console.log('Built dist/soundboard — ready for /soundboard/');
