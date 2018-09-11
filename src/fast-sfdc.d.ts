export interface Config {
  readonly stored: boolean
  apiVersion?: string
  username?: string
  password?: string
  url?: string
}

export interface Metadata {
  apiVersion: number  
}

export interface ApexClassMetadata extends Metadata {
  status: 'Active'
}

export interface ApexPageMetadata extends Metadata {
  availableInTouch: boolean
  confirmationTokenRequired: boolean
  label: string
}

export interface MetaObj {
  FullName?: string,
  MetadataContainerId: string,
  Body: string,
  ContentEntityId?: string,
  Metadata: ApexClassMetadata | ApexPageMetadata | Metadata
}

export type DoneCallback = (s: string) => void
