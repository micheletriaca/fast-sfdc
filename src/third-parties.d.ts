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

declare module 'sfdy/package-utils' {
  export function getPackageXml(opts?: {specificFiles?: string[]; specificMeta?: string[]; sfdcConnector: SfdcConnector}): Promise<Package>
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
  export function getAdapter(config: GenericObject, override?: string, packageMapping?: PackageMapping): {
    getDestructivePaths(fileNames: string[], availableFiles: string[]): string[];
    getPackageComponents(components: {type: string; fullName: string}[]): {type: string; fullName: string}[];
    isMetadataPath(fileName: string): boolean;
    resolve(fileNames: string[]): {type: string; fullName: string}[];
  } | undefined
}

type SfdyConfig = {
  readonly stored: boolean;
  sourceFormat?: 'metadata' | 'mdapi' | 'sfdx';
  sourceFolder?: string;
  apiVersion?: string;
  preDeployPlugins?: string[];
  postRetrievePlugins?: string[];
  renderers?: string[];
  staticResources?: {
    useBundleRenderer?: string[];
  };
  permissionSets?: {
    stripUselessFls: boolean;
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
