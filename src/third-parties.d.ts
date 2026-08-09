declare module 'node-salesforce-connection'
declare module 'node-salesforce-connection/xml'
declare module 'node:test' {
  export const suite: (name: string, fn: () => void) => void
  export const test: (name: string, fn: () => void) => void
}
declare module 'sfdy/deploy'
declare module 'sfdy/retrieve'
declare module 'sfdy/auth'
declare module 'sfdy/constants'
declare module 'sfdy/credentials' {
  export interface CredentialProfile {
    id?: string;
    alias?: string;
    username: string;
    environment?: string;
    instanceUrl?: string;
    refreshToken?: string;
    clientId?: string;
    clientSecret?: string;
    password?: string;
    serverUrl?: string;
    authType?: string;
  }
  export interface CredentialMetadata extends Omit<CredentialProfile, 'refreshToken' | 'clientSecret' | 'password'> {
    id: string;
    alias: string;
  }
  export interface CredentialManager {
    list(): Promise<CredentialMetadata[]>
    get(selector: string): Promise<CredentialProfile & {id: string; alias: string}>
    save(profile: CredentialProfile): Promise<CredentialProfile & {id: string; alias: string}>
    remove(selector: string): Promise<boolean>
  }
  export function createCredentialManager(options?: {basePath?: string}): CredentialManager
  export function list(): Promise<CredentialMetadata[]>
  export function get(selector: string): Promise<CredentialProfile & {id: string; alias: string}>
  export function save(profile: CredentialProfile): Promise<CredentialProfile & {id: string; alias: string}>
  export function remove(selector: string): Promise<boolean>
}
declare module 'exstream.js'

type GenericObject = { [key: string]: any };
type SfdcConnector = GenericObject

declare module 'sfdy/sfdc-utils' {
  export function newInstance(opts: {
    username: string;
    password: string;
    serverUrl?: string;
    isSandbox?: boolean;
    apiVersion: string;
    oauth2?: {
      instanceUrl?: string;
      refreshToken?: string;
      clientId?: string;
      clientSecret?: string;
    };
  }): SfdcConnector
}

declare module 'sfdy/transformer'

declare module 'sfdy/xml-utils' {
  export function buildXml(obj: GenericObject): string
}

type PackageMapping = GenericObject
type PackageType = { members: string[]; name: string[] }
type Package = { types: PackageType[]; version: string[] };
type MetadataComponent = {type: string; fullName: string; scope?: 'root'}
type ComponentModel = {
  getAddressableChildTypes(): string[];
  getComponentLocation(component: MetadataComponent): {
    parent: MetadataComponent;
    group: string;
    label: string;
    addressable: boolean;
  } | undefined;
  getContainerRoot(component: MetadataComponent): {
    label: string;
    component: MetadataComponent;
  } | undefined;
  getFolderLocation(component: MetadataComponent): {
    rootType: string;
    folderType: string;
    folderPath: string;
    label: string;
    isFolder: boolean;
  } | undefined;
  getMetadataContainers(components: MetadataComponent[]): MetadataComponent[];
  getPackageComponents(components: MetadataComponent[]): MetadataComponent[];
  isMetadataContainerPath(fileName: string): boolean;
  isMetadataFolderPath(fileName: string): boolean;
  resolveMetadata(entries: {fileName: string; data: Buffer}[]): Promise<MetadataComponent[]>;
}

declare module 'sfdy/package-utils' {
  export function getPackageXml(opts?: {specificFiles?: string[]; specificMeta?: string[]; sfdcConnector: SfdcConnector; apiVersion?: string}): Promise<Package>
  export function getPackageMapping(sfdcConnector: SfdcConnector): Promise<PackageMapping>
  export function getListOfSrcFiles(packageMapping: PackageMapping, pattern: string[]): Promise<string[]>
  export function expandDirectoryPatterns(patterns: string[], cwd?: string): string[]
}

declare module 'sfdy/path-service' {
  export function configureProject(opts: {basePath: string; srcFolder?: string; sourceFormat?: string; config?: GenericObject}): void
  export function setBasePath(basePath: string): void
  export function getBasePath(): string
  export function setSrcFolder(srcFolder: string): void
  export function getSrcFolder(absolute?: boolean): string
  export function getApiVersion(): string | undefined
}

declare module 'sfdy/format-adapters' {
  export function getAdapter(config: GenericObject, override?: string, packageMapping?: PackageMapping): ComponentModel & {
    getDestructivePaths(fileNames: string[], availableFiles: string[]): string[];
    isMetadataPath(fileName: string): boolean;
    resolve(fileNames: string[]): MetadataComponent[];
  } | undefined
  export function getComponentModel(packageMapping?: PackageMapping): ComponentModel
}

type SfdyConfig = {
  readonly stored: boolean;
  sourceFormat?: 'metadata' | 'mdapi' | 'sfdx';
  sourceFolder?: string;
  apiVersion?: string;
  preDeployPlugins?: string[];
  postRetrievePlugins?: string[];
  pluginRecipes?: Record<string, unknown>;
  renderers?: string[];
  staticResources?: {
    useBundleRenderer?: string[];
  };
  objectTranslations?: {
    stripUntranslatedFields?: boolean;
    stripNotVersionedFields?: boolean;
  };
  profiles?: {
    addAllUserPermissions?: boolean;
    addDisabledVersionedObjects?: boolean;
    addExtraObjects?: string[];
    addExtraTabVisibility?: string[];
    addExtraApplications?: string[];
    stripUserPermissionsFromStandardProfiles?: boolean;
    stripUnversionedStuff?: boolean;
  };
  roles?: {
    stripPartnerRoles?: boolean;
  };
  stripManagedPackageFields?: string[];
  excludeFiles?: string[];
}
