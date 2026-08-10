import * as vscode from 'vscode'
import configService from '../services/config-service'
import sfdcConnector from '../sfdc-connector'
import { cancellableDeployments, DeploymentRequest, deploymentTimestamp } from '../services/deployment-cancellation'
import { credentialLabel } from '../services/credential-label-service'

const CANCEL_DEPLOYMENT = 'Cancel deployment'

const describeDeployment = (deployment: DeploymentRequest): string => {
  const timestamp = deploymentTimestamp(deployment)
  return timestamp
    ? `${deployment.Status} · ${new Date(timestamp).toLocaleString()}`
    : deployment.Status
}

const chooseDeployment = async (deployments: DeploymentRequest[]): Promise<DeploymentRequest | undefined> => {
  if (deployments.length === 1) return deployments[0]
  const selected = await vscode.window.showQuickPick(deployments.map(deployment => ({
    label: `$(stop-circle) ${deployment.Id}`,
    description: describeDeployment(deployment),
    deployment
  })), {
    ignoreFocusOut: true,
    title: 'Choose a deployment to cancel',
    placeHolder: 'Pending and in-progress deployments'
  })
  return selected?.deployment
}

export default async function cancelDeploy (): Promise<void> {
  const config = await configService.getConfig()
  const credential = config.credentials[config.currentCredential]
  if (!credential) return

  try {
    const result = await sfdcConnector.query(`SELECT
      Id,
      Status,
      CreatedDate,
      StartDate
      FROM DeployRequest
      WHERE Status IN ('Pending', 'InProgress')
      ORDER BY CreatedDate DESC`
    )
    const deployments = cancellableDeployments(result.records || [])
    if (!deployments.length) {
      await vscode.window.showInformationMessage(
        `No cancellable deployment was found in ${credentialLabel(credential)}.`
      )
      return
    }

    const deployment = await chooseDeployment(deployments)
    if (!deployment) return
    const answer = await vscode.window.showWarningMessage(
      `Cancel deployment ${deployment.Id} in ${credentialLabel(credential)}?`,
      {
        modal: true,
        detail: 'Salesforce will finish its current step and roll back the deployment asynchronously.'
      },
      CANCEL_DEPLOYMENT
    )
    if (answer !== CANCEL_DEPLOYMENT) return

    await sfdcConnector.cancelDeploy(deployment.Id)
    await vscode.window.showInformationMessage(
      `Cancellation requested for deployment ${deployment.Id}. Salesforce is processing the request.`
    )
  } catch (error) {
    await vscode.window.showErrorMessage(`Unable to cancel the deployment: ${error.message}`)
  }
}
