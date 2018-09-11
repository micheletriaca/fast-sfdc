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

export interface ApexComponentMetadata extends Metadata {
  description: string,
  label: string  
}

export interface MetaObj {
  FullName?: string,
  MetadataContainerId: string,
  Body: string,
  ContentEntityId?: string,
  Metadata: ApexClassMetadata | ApexPageMetadata | ApexComponentMetadata | Metadata
}

export type DoneCallback = (s: string) => void
