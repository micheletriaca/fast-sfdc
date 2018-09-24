import statusbar from '../statusbar'
import * as path from 'path'
import * as vscode from 'vscode'
import sfdcConnector from '../sfdc-connector'
import * as decompress from 'decompress'
import * as b64 from 'base64-async'

export default async function retrieve () {
  statusbar.startLongJob(async done => {
    const srcFolder = path.resolve(vscode.workspace.rootPath as string, 'src')
    const packageXmlPath = path.resolve(srcFolder, 'package.xml')
    const retrieveJob = await sfdcConnector.retrieveMetadata(packageXmlPath)
    const retrieveResult = await sfdcConnector.pollRetrieveMetadataStatus(retrieveJob.id)
    const zipBuffer = await b64.decode(retrieveResult.zipFile)
    await decompress(zipBuffer, srcFolder)
    done('👍🏻')
  })
}
