import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { runInNewContext } from 'node:vm'
import { x } from 'tar'
const exec = promisify(execFile)

test('real packed distribution imports its host and registers the external-React client', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-review-package-'))
  try {
    // The npm CLI that started npm test is portable across cmd.exe and POSIX.
    const npm = process.env.npm_execpath
    assert.ok(npm, 'run distribution tests through npm test')
    const { stdout } = await exec(
      process.execPath,
      [npm, 'pack', '--json', '--pack-destination', root],
      {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        maxBuffer: 2 * 1024 * 1024,
      },
    )
    const start = stdout.indexOf('[\n'),
      pack = JSON.parse(stdout.slice(start))[0]
    assert.equal(pack.name, 'dsh-page-review')
    assert.equal(
      pack.files.some((f) => /^(node_modules|backups|tests)\//.test(f.path)),
      false,
    )
    await x({ file: join(root, pack.filename), cwd: root })
    await exec(
      process.execPath,
      [
        npm,
        'install',
        '--omit=dev',
        '--ignore-scripts',
        '--package-lock=false',
        '--no-audit',
        '--no-fund',
      ],
      { cwd: join(root, 'package'), maxBuffer: 2 * 1024 * 1024 },
    )
    const host = await import(pathToFileURL(join(root, 'package/lib/index.js')))
    assert.equal(host.name, 'dsh-page-review')
    assert.equal(typeof host.apply, 'function')
    let registration
    runInNewContext(
      await readFile(join(root, 'package/lib/client.js'), 'utf8'),
      {
        window: {
          __ModuleLoader__: { load: (value) => (registration = value) },
        },
        Map,
        Set,
        console,
      },
    )
    assert.equal(registration.id, 'dsh-page-review')
    const required = []
    const client = registration.factory((name) => {
      required.push(name)
      if (name === 'react' || name === 'react-dom') return {}
      throw Error('unexpected runtime dependency ' + name)
    })
    assert.equal(typeof client.apply, 'function')
    assert.ok(client.inject.includes('locale'))
    assert.ok(
      required.includes('react'),
      'React must be supplied by the host, not bundled',
    )
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 3 })
  }
})
