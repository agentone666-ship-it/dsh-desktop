import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'

const root = new URL('./', import.meta.url)
await mkdir(new URL('lib/', root), { recursive: true })
await writeFile(
  new URL('lib/index.js', root),
  "export * from '../src/host.mjs'\n",
)
const result = await build({
  entryPoints: [new URL('src/client.jsx', root).pathname],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  external: ['react', 'react-dom'],
  loader: { '.css': 'text' },
  legalComments: 'inline',
})
await writeFile(
  new URL('lib/client.js', root),
  `window.__ModuleLoader__.load({id:'dsh-page-review',factory:(require)=>{const module={exports:{}};const exports=module.exports;\n${result.outputFiles[0].text}\nreturn module.exports;}});\n`,
)
