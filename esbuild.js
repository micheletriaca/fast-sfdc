// @ts-check
'use strict'

const esbuild = require('esbuild')
const fs = require('fs')

const production = process.argv.includes('--production')
const watch = process.argv.includes('--watch')

const watchPlugin = {
  name: 'watch-reporter',
  /**
   * @param {{ onStart: (arg0: () => void) => void; onEnd: (arg0: () => void) => void; }} build
   */
  setup (build) {
    build.onStart(() => {
      console.log('[watch] build started')
    })
    build.onEnd(() => {
      console.log('[watch] build finished')
    })
  }
}

const sfdyLoggingPlugin = {
  name: 'sfdy-logging',
  setup (build) {
    build.onLoad({ filter: /[/\\]sfdy[/\\]src[/\\](deploy|retrieve)[/\\]index\.js$/ }, async ({ path: modulePath }) => ({
      contents: (await fs.promises.readFile(modulePath, 'utf8'))
        .replaceAll('console.time(', 'logger.time(')
        .replaceAll('console.timeEnd(', 'logger.timeEnd('),
      loader: 'js'
    }))
  }
}

async function main () {
  const context = await esbuild.context({
    absWorkingDir: __dirname,
    entryPoints: ['src/extension.ts'],
    bundle: true,
    external: ['vscode'],
    format: 'cjs',
    minify: production,
    outfile: 'dist/extension.js',
    platform: 'node',
    plugins: watch ? [sfdyLoggingPlugin, watchPlugin] : [sfdyLoggingPlugin],
    sourcemap: 'external',
    sourcesContent: false,
    target: 'node20'
  })

  if (watch) {
    await context.watch()
  } else {
    await context.rebuild()
    await context.dispose()
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
