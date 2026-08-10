import * as path from 'path'
import { configureProject, getApiVersion, getSrcFolder } from 'sfdy/path-service'

const toPortablePath = (filePath: string): string => filePath.replace(/\\/g, '/')

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
  const relativeRoot = toPortablePath(getSrcFolder())
  const root = path.resolve(workspaceRoot, relativeRoot)
  const relativePrefix = relativeRoot.endsWith('/') ? relativeRoot : relativeRoot + '/'

  return {
    apiVersion: getApiVersion(),
    contains: filePath => {
      const relative = path.relative(root, filePath)
      return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
    },
    isSourceFormat: config.sourceFormat?.toLowerCase() === 'sfdx',
    relativeRoot,
    root,
    toRelativePath: filePath => {
      if (path.isAbsolute(filePath)) {
        const relative = path.relative(root, filePath)
        if (relative === '') return ''
        if (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
          return toPortablePath(relative)
        }
      }
      const normalized = toPortablePath(filePath).replace(/^\.\//, '')
      if (normalized === relativeRoot) return ''
      if (normalized.startsWith(relativePrefix)) return normalized.substring(relativePrefix.length)
      return normalized.replace(/^\/+/, '')
    }
  }
}
