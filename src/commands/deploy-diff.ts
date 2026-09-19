import * as vscode from 'vscode'
import * as path from 'path'
import { git, getChangedSourceFiles, getGitReferences, resolveCommit } from '../services/git-diff-service'
import deploy from './deploy'
import configService from '../services/config-service'
import { resolveSourceLayout } from '../services/source-layout-service'
import utils from '../utils/utils'

const MAX_PREVIEWED_FILES = 20

const filePreview = (files: string[]) => {
  const preview = files.slice(0, MAX_PREVIEWED_FILES).join('\n')
  const remaining = files.length - MAX_PREVIEWED_FILES
  return remaining > 0 ? `${preview}\n...and ${remaining} more` : preview
}

export default async function deployDiff (checkOnly = false) {
  const rootFolder = utils.getWorkspaceFolder()

  let branchName: string
  try {
    branchName = git(['branch', '--show-current'], rootFolder).trim()
  } catch (e) {
    vscode.window.showErrorMessage(`Unable to read the current git branch: ${e.message}`)
    return
  }

  const action = checkOnly ? 'Validate' : 'Deploy'
  const title = `${action} git diff on branch ${branchName || '(detached HEAD)'}`
  const comparison = await vscode.window.showQuickPick([
    { label: 'Number of commits', description: 'Compare HEAD with an earlier commit', mode: 'commits' },
    { label: 'Branch or tag', description: 'Compare a branch or tag with HEAD', mode: 'reference' }
  ], { title, placeHolder: 'What would you like to compare HEAD with?', ignoreFocusOut: true })
  if (!comparison) return

  let baseRef: string
  let baseLabel: string
  if (comparison.mode === 'commits') {
    const answer = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      title,
      prompt: 'Diff is calculated between HEAD and the given number of commits behind',
      placeHolder: 'How many commits behind?',
      value: '1',
      validateInput: value => /^[1-9]\d*$/.test(value.trim()) ? null : 'Enter a positive integer'
    })
    if (!answer) return
    baseRef = `HEAD~${answer.trim()}`
    baseLabel = baseRef
  } else {
    try {
      const references = getGitReferences(rootFolder)
      if (!references.length) {
        vscode.window.showWarningMessage('No branches or tags found in this repository.')
        return
      }
      const reference = await vscode.window.showQuickPick(references.map(ref => ({
        label: ref.name,
        description: ref.kind,
        ref: ref.ref
      })), {
        title,
        placeHolder: 'Select a branch or tag to compare with HEAD (type to filter)',
        ignoreFocusOut: true,
        matchOnDescription: true
      })
      if (!reference) return
      baseRef = reference.ref
      baseLabel = reference.label
    } catch (e) {
      vscode.window.showErrorMessage(`Unable to read Git references: ${e.message}`)
      return
    }
  }

  const diffLabel = `${baseLabel}..HEAD`
  const layout = resolveSourceLayout(rootFolder, configService.getSfdyConfigSync())

  let changedFiles: string[]
  try {
    const diffCfg = `${resolveCommit(rootFolder, baseRef)}..${resolveCommit(rootFolder, 'HEAD')}`
    changedFiles = getChangedSourceFiles(layout.root, diffCfg)
  } catch (e) {
    vscode.window.showErrorMessage(`Unable to compute the git diff: ${e.message}`)
    return
  }

  if (!changedFiles.length) {
    vscode.window.showWarningMessage(`No changed files found in ${diffLabel} under ${layout.relativeRoot}`)
    return
  }

  const contentNotice = `Files are selected using the Git diff. Their current local contents will be ${checkOnly ? 'validated' : 'deployed'}, including uncommitted changes.`
  const message = `${action} ${changedFiles.length} changed file(s) from ${diffLabel}?`
  let confirmed: string | undefined = await vscode.window.showWarningMessage(
    message,
    { modal: true, detail: `${contentNotice}\n\n${filePreview(changedFiles)}` },
    action,
    'Show full preview'
  )
  if (confirmed === 'Show full preview') {
    const document = await vscode.workspace.openTextDocument({
      language: 'plaintext',
      content: [
        `${action} git diff: ${diffLabel}`,
        `Source folder: ${layout.root}`,
        `${changedFiles.length} changed file(s). Deleted files are excluded.`,
        contentNotice,
        '',
        ...changedFiles
      ].join('\n')
    })
    await vscode.window.showTextDocument(document, { preview: false })
    // Keep the editor usable while the user reviews the full list.
    confirmed = await vscode.window.showWarningMessage(message, action, 'Cancel')
  }
  if (confirmed !== action) return

  await deploy(checkOnly, false, changedFiles.map(file => path.resolve(layout.root, file)))
}
