import * as vscode from 'vscode'
import * as path from 'path'
import sfdcConnector from '../sfdc-connector'
import statusbar from '../statusbar'
import * as decompress from 'decompress'
import * as b64 from 'base64-async'

export default function retrieveSingle () {
  statusbar.startLongJob(async done => {
    if (!vscode.window.activeTextEditor || !vscode.window.activeTextEditor.document) return done('👎🏻')
    const fileName = vscode.window.activeTextEditor.document.fileName
    const srcFolder = path.resolve(vscode.workspace.rootPath as string, 'src')
    const retrieveJob = await sfdcConnector.retrieveSingleMetadata(fileName)
    const retrieveResult = await sfdcConnector.pollRetrieveMetadataStatus(retrieveJob.id)
    const zipBuffer = await b64.decode(retrieveResult.zipFile)
    await decompress(zipBuffer, srcFolder, {
      filter: file => file.path !== 'package.xml'
    })
    done('👍🏻')
  })
}
