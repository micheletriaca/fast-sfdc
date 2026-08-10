/**
 * Keep filesystem paths in the operating system's native form.
 *
 * In particular, converting a Windows UNC path to POSIX separators with
 * `upath.toUnix` collapses its leading `\\\\` and redirects access to the
 * current drive instead of the network share.
 */
export const preserveNativePath = (filePath: string): string => filePath
