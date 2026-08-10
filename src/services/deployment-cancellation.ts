export interface DeploymentRequest {
  Id: string;
  Status: string;
  CreatedDate?: string;
  StartDate?: string;
}

const cancellableStatuses = new Set(['Pending', 'InProgress'])

export const cancellableDeployments = (records: DeploymentRequest[]): DeploymentRequest[] => records
  .filter(record => cancellableStatuses.has(record.Status))

export const deploymentTimestamp = (record: DeploymentRequest): string | undefined =>
  record.StartDate || record.CreatedDate
