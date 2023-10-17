

export interface DeploymentRecord {
  id: string,
  type: string,
  account: string,
  region: string,
}

export interface Deployment {
  id: string,
  type: string,
  account: string,
  region: string,
  provisioned?: boolean
}