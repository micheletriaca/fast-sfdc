import * as fs from 'fs'
import * as os from 'os'
import * as path from 'upath'
import { getBasePath, getSrcFolder, setBasePath, setSrcFolder } from 'sfdy/path-service'
import configService from './config-service'
import sfdcConnector from '../sfdc-connector'
import logger from '../logger'
import sfdyDeploy = require('sfdy/deploy')

let deploymentQueue: Promise<void> = Promise.resolve()

const xmlEscape = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

const getPackageXml = (bundleName: string, apiVersion: string): string => `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>${xmlEscape(bundleName)}</members>
    <name>LightningComponentBundle</name>
  </types>
  <version>${xmlEscape(apiVersion)}</version>
</Package>
`

const deployResource = async (bundleName: string, filePath: string, source: string): Promise<void> => {
  const config = await configService.getConfig()
  const creds = config.credentials[config.currentCredential]
  const apiVersion = await configService.getPackageXmlVersion()
  const resources = await sfdcConnector.findLwcBundleResources(bundleName)
  const expectedPrefix = `lwc/${bundleName}/`
  const normalizedTargetPath = path.normalize(filePath)
  let targetFound = false
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fastsfdc-lwc-'))
  const previousBasePath = getBasePath()
  const previousSrcFolder = getSrcFolder()

  try {
    for (const resource of resources) {
      const normalizedResourcePath = path.normalize(resource.FilePath)
      if (!normalizedResourcePath.startsWith(expectedPrefix) || normalizedResourcePath.includes('../')) {
        throw Error(`Unexpected Lightning component resource path: ${resource.FilePath}`)
      }
      const destination = path.join(tempRoot, 'src', normalizedResourcePath)
      fs.mkdirSync(path.dirname(destination), { recursive: true })
      const isTarget = normalizedResourcePath === normalizedTargetPath
      fs.writeFileSync(destination, isTarget ? source : resource.Source, 'utf8')
      if (isTarget) targetFound = true
    }

    if (!targetFound) throw Error(`Unable to find ${filePath} among the remote resources of ${bundleName}`)

    const packagePath = path.join(tempRoot, 'src', 'package.xml')
    fs.mkdirSync(path.dirname(packagePath), { recursive: true })
    fs.writeFileSync(packagePath, getPackageXml(bundleName, apiVersion), 'utf8')

    logger.appendLine(`Deploying ${bundleName} from ${resources.length} Tooling API resources; only ${filePath} was replaced`)
    const deployResult = await sfdyDeploy({
      logger: (message: string) => logger.appendLine(message),
      basePath: tempRoot,
      srcFolder: 'src',
      loginOpts: {
        serverUrl: creds.url,
        username: creds.username,
        password: creds.password,
        instanceUrl: creds.type === 'oauth2' ? creds.instanceUrl : undefined,
        refreshToken: creds.type === 'oauth2' ? creds.password : undefined,
        clientId: creds.clientId,
        clientSecret: creds.clientSecret
      },
      checkOnly: false,
      files: `lwc/${bundleName}/**/*`,
      preDeployPlugins: [],
      renderers: [],
      config: {}
    })
    if (deployResult.status !== 'Succeeded') {
      throw Error(`Metadata deployment of ${bundleName} ended with status ${deployResult.status || 'unknown'}`)
    }
    logger.appendLine(`Metadata fallback completed for ${filePath}`)
  } finally {
    setBasePath(previousBasePath)
    setSrcFolder(previousSrcFolder)
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
}

export default {
  deployResource (bundleName: string, filePath: string, source: string): Promise<void> {
    const deployment = deploymentQueue.then(() => deployResource(bundleName, filePath, source))
    deploymentQueue = deployment.then(() => undefined, () => undefined)
    return deployment
  }
}
