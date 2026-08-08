import * as path from 'upath'
import { configureProject, getApiVersion, getSrcFolder } from 'sfdy/path-service'

export type SourceLayout = {
  apiVersion?: string;
  contains: (filePath: string) => boolean;
  isSourceFormat: boolean;
  relativeRoot: string;
  root: string;
  toRelativePath: (filePath: string) => string;
}

export const resolveSourceLayout = (workspaceRoot: string, config: SfdyConfig): SourceLayout => {
  configureProject({ basePath: workspaceRoot, sourceFormat: config.sourceFormat, config })
  const relativeRoot = path.toUnix(getSrcFolder())
  const root = path.resolve(workspaceRoot, relativeRoot)
  const rootPrefix = root.endsWith('/') ? root : root + '/'
  const relativePrefix = relativeRoot.endsWith('/') ? relativeRoot : relativeRoot + '/'

  return {
    apiVersion: getApiVersion(),
    contains: filePath => {
      const relative = path.relative(root, path.toUnix(filePath))
      return relative !== '..' && !relative.startsWith('../') && !path.isAbsolute(relative)
    },
    isSourceFormat: config.sourceFormat?.toLowerCase() === 'sfdx',
    relativeRoot,
    root,
    toRelativePath: filePath => {
      const normalized = path.toUnix(filePath).replace(/^\.\//, '')
      if (normalized === root) return ''
      if (normalized.startsWith(rootPrefix)) return normalized.substring(rootPrefix.length)
      if (normalized === relativeRoot) return ''
      if (normalized.startsWith(relativePrefix)) return normalized.substring(relativePrefix.length)
      return normalized.replace(/^\/+/, '')
    }
  }
}
