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

export type GitReference = { name: string; ref: string; kind: string }

export const getGitReferences = (cwd: string): GitReference[] => {
  return git(['for-each-ref', '--sort=refname', '--format=%(refname)%00%(symref)', 'refs/heads', 'refs/remotes', 'refs/tags'], cwd)
    .split('\n')
    .filter(line => line.length > 0)
    .flatMap(line => {
      const [ref, symbolicTarget] = line.split('\0')
      if (symbolicTarget) return []
      const prefix = ref.startsWith('refs/heads/') ? 'refs/heads/' : ref.startsWith('refs/remotes/') ? 'refs/remotes/' : 'refs/tags/'
      return [{ name: ref.substring(prefix.length), ref, kind: prefix === 'refs/heads/' ? 'Local branch' : prefix === 'refs/remotes/' ? 'Remote branch' : 'Tag' }]
    })
}

export const resolveCommit = (cwd: string, ref: string): string => {
  return git(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`], cwd).trim()
}
