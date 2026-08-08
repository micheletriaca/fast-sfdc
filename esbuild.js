// @ts-check
'use strict'

const esbuild = require('esbuild')

const production = process.argv.includes('--production')
const watch = process.argv.includes('--watch')

const watchPlugin = {
  name: 'watch-reporter',
  setup (build) {
    build.onStart(() => {
      console.log('[watch] build started')
    })
    build.onEnd(() => {
      console.log('[watch] build finished')
    })
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
    plugins: watch ? [watchPlugin] : [],
    sourcemap: 'external',
    sourcesContent: false,
    target: 'node14'
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
