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

export interface AuraMetadata extends Metadata {
  description: string
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
  Id?: string
  FullName: string,
  Body: string,
  MetadataContainerId?: string,
  Metadata?: AnyMetadata
}

type AnyMetadata = ApexClassMetadata | ApexPageMetadata | ApexComponentMetadata | Metadata

export interface AuraObj {
  Id?: string,
  FullName: string,
  Source: string,
  MetadataContainerId?: string,
  Metadata?: AuraMetadata
}

export type DoneCallback = (s: string) => void
