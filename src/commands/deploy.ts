import sfdcConnector from '../sfdc-connector'
import * as vscode from 'vscode'
import * as path from 'path'
import * as AdmZip from 'adm-zip'
import statusbar from '../statusbar'

export default async function deploy (checkOnly: boolean = false) {
  statusbar.startLongJob(async done => {
    const srcPath = path.resolve(vscode.workspace.rootPath as string, 'src')
    const zip = new AdmZip()
    zip.addLocalFolder(srcPath)
    const base64 = zip.toBuffer().toString('base64')
    const deployJob = await sfdcConnector.deployMetadata(base64, {
      checkOnly,
      singlePackage: true
    })
    const deployResult = await sfdcConnector.pollDeployMetadataStatus(deployJob.id)
    if (deployResult.status === 'Succeeded') done('👍🏻')
    else done('👎🏻')
  })
}
