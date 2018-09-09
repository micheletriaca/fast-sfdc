export interface Config {
  readonly stored: boolean
  apiVersion?: string
  username?: string
  password?: string
  url?: string
}

export type DoneCallback = (s: string) => void
