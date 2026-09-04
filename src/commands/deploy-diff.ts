import * as vscode from 'vscode'
import { spawnSync } from 'child_process'
import deploy from './deploy'
import configService from '../services/config-service'
import { resolveSourceLayout } from '../services/source-layout-service'
import utils from '../utils/utils'

const MAX_PREVIEWED_FILES = 20

const git = (args: string[], cwd: string) => {
  const res = spawnSync('git', args, { cwd })
  if (res.error) throw Error(res.error.message)
  if (res.status !== 0) throw Error(res.stderr.toString('utf8').trim() || `git ${args[0]} failed`)
  return res.stdout.toString('utf8').trim()
}

const filePreview = (files: string[]) => {
  const preview = files.slice(0, MAX_PREVIEWED_FILES).join('\n')
  const remaining = files.length - MAX_PREVIEWED_FILES
  return remaining > 0 ? `${preview}\n...and ${remaining} more` : preview
}

export default async function deployDiff (checkOnly = false) {
  const rootFolder = utils.getWorkspaceFolder()

  let branchName: string
  try {
    branchName = git(['branch', '--show-current'], rootFolder)
  } catch (e) {
    vscode.window.showErrorMessage(`Unable to read the current git branch: ${e.message}`)
    return
  }

  const answer = await vscode.window.showInputBox({
    ignoreFocusOut: true,
    title: `${checkOnly ? 'Validate' : 'Deploy'} git diff on branch ${branchName || '(detached HEAD)'}`,
    prompt: 'Diff is calculated between HEAD and the given number of commits behind',
    placeHolder: 'How many commits behind?',
    value: '1',
    validateInput: value => /^[1-9]\d*$/.test(value.trim()) ? null : 'Enter a positive integer'
  })
  if (!answer) return

  const diffCfg = `HEAD~${parseInt(answer.trim(), 10)}..HEAD`
  const layout = resolveSourceLayout(rootFolder, configService.getSfdyConfigSync())
  const srcPrefix = layout.relativeRoot.endsWith('/') ? layout.relativeRoot : layout.relativeRoot + '/'

  let changedFiles: string[]
  try {
    changedFiles = git(['diff', '--name-only', '--diff-filter=d', diffCfg], rootFolder)
      .split('\n')
      .map(x => x.trim())
      .filter(x => x.startsWith(srcPrefix))
      .map(x => x.substring(srcPrefix.length))
  } catch (e) {
    vscode.window.showErrorMessage(`Unable to compute the git diff: ${e.message}`)
    return
  }

  if (!changedFiles.length) {
    vscode.window.showWarningMessage(`No changed files found in ${diffCfg} under ${layout.relativeRoot}`)
    return
  }

  const confirmed = await vscode.window.showWarningMessage(
    `${checkOnly ? 'Validate' : 'Deploy'} ${changedFiles.length} changed file(s) from ${diffCfg}?`,
    {
      modal: true,
      detail: filePreview(changedFiles)
    },
    checkOnly ? 'Validate' : 'Deploy'
  )
  if (!confirmed) return

  await deploy(checkOnly, false, [], diffCfg)
}
