declare module 'node-salesforce-connection'
declare module 'node-salesforce-connection/xml'
declare module 'sfdy/src/deploy'
declare module 'sfdy/src/retrieve'
declare module 'sfdy/src/utils/sfdc-utils' {
  export function newInstance(opts: {
    username: string;
    password: string;
    serverUrl?: string;
    isSandbox?: boolean;
    apiVersion: string;
  }): SfdcConnector
}

type GenericObject = { [key: string]: any };

declare module 'sfdy/src/utils/xml-utils' {
  export function buildXml(obj: GenericObject): string
}
declare module 'sfdy/src/utils/package-utils' {
  export function getPackageXml(opts?: {specificFiles: string[]; sfdcConnector: SfdcConnector}): Promise<Package>
  export function getPackageMapping(sfdcConnector: SfdcConnector): Promise<PackageMapping>
  export function getListOfSrcFiles(packageMapping: PackageMapping, pattern: string[]): Promise<string[]>
}

type SfdcConnector = GenericObject
type PackageMapping = GenericObject
type Package = { types: PackageType[]; version: string[] };
type PackageType = { members: string[]; name: string[] }

declare module 'sfdy/src/services/path-service' {
  export function setBasePath(basePath: string): void
}
