export interface Config {
  readonly stored: boolean;
  credentials: ConfigCredential[];
  currentCredential: number;
}

export interface ConfigCredential {
  username?: string;
  password?: string;
  url?: string;
  deployOnSave?: boolean;
}

export interface Metadata {
  apiVersion: number;
}

export interface AuraMetadata extends Metadata {
  description: string;
}

export interface ApexClassMetadata extends Metadata {
  status: 'Active';
}

export interface ApexPageMetadata extends Metadata {
  availableInTouch: boolean;
  confirmationTokenRequired: boolean;
  label: string;
}

export interface ApexComponentMetadata extends Metadata {
  description: string;
  label: string;
}

export interface LwcMetadata extends Metadata {
  description: string;
  isExposed: boolean;
  targets: {
    target: string[];
  };
}

export interface MetaObj {
  Id?: string;
  FullName: string;
  Body: string;
  MetadataContainerId?: string;
  Metadata?: AnyMetadata;
}

type AnyMetadata = ApexClassMetadata | ApexPageMetadata | ApexComponentMetadata | LwcMetadata | Metadata

type AuraDefType = 'APPLICATION'
  | 'CONTROLLER'
  | 'COMPONENT'
  | 'EVENT'
  | 'HELPER'
  | 'INTERFACE'
  | 'RENDERER'
  | 'STYLE'
  | 'PROVIDER'
  | 'MODEL'
  | 'TESTSUITE'
  | 'DOCUMENTATION'
  | 'TOKENS'
  | 'DESIGN'
  | 'SVG'

type AuraFormat = 'XML' | 'JS' | 'CSS'

export interface AuraObj {
  Id?: string;
  Source: string;
  AuraDefinitionBundleId?: string;
  DefType: AuraDefType;
  Format: AuraFormat;
}

export interface LwcObj {
  Id?: string;
  LightningComponentBundleId?: string;
  FullName?: string;
  Metadata?: any;
}

export interface AuraBundle {
  Id?: string;
  ApiVersion: number;
  Description: string;
  DeveloperName: string;
  MasterLabel: string;
}

export interface TestExecutionResult {
  successes: TestResult[];
  failures: TestResult[];
}

export interface TestResult {
  name: string;
  methodName: string;
  message: string;
  stackTrace: string;
}

export type DoneCallback = (s: string) => void
