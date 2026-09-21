import * as vscode from 'vscode'
import Speaker = require('speaker')

const completionTone = (() => {
  const sampleRate = 44100
  const duration = 0.65
  const samples = Math.floor(sampleRate * duration)
  const tone = Buffer.alloc(samples * 2)

  for (let sample = 0; sample < samples; sample++) {
    const time = sample / sampleRate
    const firstNote = time < 0.42 ? Math.exp(-time * 7) : 0
    const secondTime = time - 0.16
    const secondNote = secondTime >= 0 ? Math.exp(-secondTime * 6) : 0
    const firstBell = Math.sin(2 * Math.PI * 784 * time) + 0.35 * Math.sin(2 * Math.PI * 1176 * time)
    const secondBell = Math.sin(2 * Math.PI * 659 * secondTime) + 0.3 * Math.sin(2 * Math.PI * 988 * secondTime)
    const value = Math.round((firstBell * firstNote * 0.55 + secondBell * secondNote * 0.45) * 0x3000)
    tone.writeInt16LE(value, sample * 2)
  }

  return tone
})()

const ignoreAudioError = () => undefined

export const playCompletionSound = () => {
  if (!vscode.workspace.getConfiguration('fast-sfdc').get<boolean>('retrieveSound', true)) return
  try {
    const speaker = new Speaker({ channels: 1, bitDepth: 16, sampleRate: 44100 })
    speaker.on('error', ignoreAudioError)
    speaker.end(completionTone)
  } catch {
    ignoreAudioError()
  }
}
