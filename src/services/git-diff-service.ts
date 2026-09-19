import { spawnSync } from 'child_process'

export const git = (args: string[], cwd: string): string => {
  const res = spawnSync('git', args, { cwd })
  if (res.error) throw Error(res.error.message)
  if (res.status !== 0) throw Error(res.stderr.toString('utf8').trim() || `git ${args[0]} failed`)
  return res.stdout.toString('utf8')
}

export const getChangedSourceFiles = (sourceRoot: string, range: string): string[] => {
  // --relative excludes paths outside cwd, even when the project is nested in a repository.
  // NUL delimiters preserve Unicode, whitespace and newlines without Git quoting paths.
  return git(['diff', '--name-only', '-z', '--relative', '--diff-filter=d', range, '--'], sourceRoot)
    .split('\0')
    .filter(file => file.length > 0)
}
