import fs from 'fs'
import os from 'os'
import path from 'path'
import readline from 'readline'

export function getFireworksConfigPath(): string {
  return path.join(os.homedir(), '.codebuff', 'config.json')
}

export function readFireworksApiKey(): string | null {
  try {
    const configPath = getFireworksConfigPath()
    if (!fs.existsSync(configPath)) return null
    const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    return typeof data.fireworksApiKey === 'string' ? data.fireworksApiKey : null
  } catch {
    return null
  }
}

export function writeFireworksApiKey(key: string): void {
  const configDir = path.join(os.homedir(), '.codebuff')
  fs.mkdirSync(configDir, { recursive: true, mode: 0o700 })
  const configPath = getFireworksConfigPath()
  let existing: Record<string, unknown> = {}
  try {
    if (fs.existsSync(configPath)) {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    }
  } catch {
    // ignore parse errors, start fresh
  }
  existing.fireworksApiKey = key
  fs.writeFileSync(configPath, JSON.stringify(existing, null, 2))
  fs.chmodSync(configPath, 0o600)
}

export async function promptFireworksApiKey(): Promise<string> {
  process.stdout.write('Enter your Fireworks AI API key: ')

  return new Promise<string>((resolve) => {
    if (process.stdin.isTTY) {
      let input = ''
      const stdin = process.stdin
      stdin.setRawMode?.(true)
      stdin.resume()

      const onData = (data: Buffer) => {
        for (let i = 0; i < data.length; i++) {
          const char = data[i]
          if (char === 0x03) {
            stdin.setRawMode?.(false)
            stdin.pause()
            stdin.removeListener('data', onData)
            process.exit(130)
          }
          if (char === 0x0d || char === 0x0a) {
            stdin.setRawMode?.(false)
            stdin.pause()
            stdin.removeListener('data', onData)
            process.stdout.write('\n')
            resolve(input)
            return
          }
          if (char === 0x7f || char === 0x08) {
            if (input.length > 0) {
              input = input.slice(0, -1)
              process.stdout.write('\b \b')
            }
            continue
          }
          input += String.fromCharCode(char)
          process.stdout.write('*')
        }
      }

      stdin.on('data', onData)
    } else {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })
      rl.question('', (answer: string) => {
        rl.close()
        resolve(answer)
      })
    }
  }).then((key) => {
    const trimmed = key.trim()
    if (!trimmed) throw new Error('No API key provided')
    return trimmed
  })
}

export async function ensureFireworksApiKey(): Promise<string> {
  const existing = readFireworksApiKey()
  if (existing) return existing
  const key = await promptFireworksApiKey()
  writeFireworksApiKey(key)
  console.error('Saved Fireworks API key to ~/.codebuff/config.json')
  return key
}
