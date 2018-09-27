import sfdcConnector from '../sfdc-connector'
import * as vscode from 'vscode'
import * as path from 'path'
import * as AdmZip from 'adm-zip'
import statusbar from '../statusbar'

const sbItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 4)

export default async function deploy (checkOnly: boolean = false) {
  statusbar.startLongJob(async done => {
    const srcPath = path.resolve(vscode.workspace.rootPath as string, 'src')
    const zip = new AdmZip()
    zip.addLocalFolder(srcPath)
    const base64 = zip.toBuffer().toString('base64')
    sbItem.text = 'Deploy... uploading data'
    sbItem.show()
    const deployJob = await sfdcConnector.deployMetadata(base64, {
      checkOnly,
      singlePackage: true
    })
    sbItem.text = `Deploy... data uploaded`
    const deployResult = await sfdcConnector.pollDeployMetadataStatus(deployJob.id, (r: any) => {
      const numProcessed = parseInt(r.numberComponentsDeployed, 10) + parseInt(r.numberComponentErrors, 10)
      sbItem.text = `Deploy: ${r.status} (${numProcessed}/${r.numberComponentsTotal}) - Errors: ${r.numberComponentErrors}`
    })
    done(deployResult.status === 'Succeeded' ? '👍🏻' : '👎🏻')
  })
}
