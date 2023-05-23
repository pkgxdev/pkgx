import useConfig, { Verbosity } from "./useConfig.ts"
import { colors, tty } from "cliffy/ansi/mod.ts"
import { utils } from "tea"
const { flatmap } = utils

// ref https://github.com/chalk/ansi-regex/blob/main/index.js
const ansi_escapes_rx = new RegExp([
  '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
  '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))'
].join('|'), 'g')

export function strip_ansi_escapes(input: string) {
  return input.replace(ansi_escapes_rx, '')
}

function ln(s: string, prefix_length: number) {
  try {
    // remove ansi escapes to get actual length
    const n = strip_ansi_escapes(s).length + prefix_length
    const { columns } = Deno.consoleSize()
    return Math.ceil(n / columns)
  } catch {
    // consoleSize() throws if not a tty
    // eg. in GitHub Actions
    return 1
  }
}

export default function() {
  return {
    new: useLogger,
    teal, red, gray, dark, lite,
    logJSON
  }
}

function useLogger(prefix?: string) {
  const { modifiers: { verbosity }, logger: { prefix: loggerGlobalPrefix, color } } = useConfig()
  return new Logger(verbosity, prefix, loggerGlobalPrefix, color)
}

function colorIfTTY(x: string, colorMethod: (x: string)=>string) {
  return useConfig().logger.color ? colorMethod(x) : x
}

export const teal = (x: string) => colorIfTTY(x, (x) => colors.rgb8(x, 86))
export const red = (x: string) => colorIfTTY(x, colors.brightRed)
export const gray = (x: string) => colorIfTTY(x, (x) => colors.rgb8(x, 244))
export const dark = (x: string) => colorIfTTY(x, (x) => colors.rgb8(x, 238))
export const lite = (x: string) => colorIfTTY(x, (x) => colors.rgb8(x, 252))

export class Logger {
  readonly verbosity: Verbosity
  readonly prefix: string
  readonly globalPrefix?: string
  readonly sequences_ok: boolean
  lines = 0
  last_line = ''
  tty = tty({ stdout: Deno.stderr })
  prefix_length: number

  constructor(verbosity: Verbosity, prefix: string | undefined, globalPrefix: string | undefined, sequences_ok: boolean) {
    this.verbosity = verbosity
    this.sequences_ok = sequences_ok

    prefix = prefix?.chuzzle()
    this.prefix_length = prefix?.length ?? 0
    this.prefix = prefix ? `${gray(prefix)} ` : ''

    if (globalPrefix) {
      this.globalPrefix = globalPrefix
      this.prefix = `${dark(globalPrefix)} ${this.prefix}`
      this.prefix_length += globalPrefix.length + 1
    }
  }

  //TODO don’t erase whole lines, just erase the part that is different
  replace(line: string, {prefix: wprefix}: {prefix: boolean} = {prefix: true}) {
    if (this.verbosity < -1) return

    if (line == this.last_line) {
      return  //noop
    }

    if (this.lines) {
      const n = ln(this.last_line, this.prefix_length)
      if (this.sequences_ok) {
        this.tty.cursorLeft.cursorUp(n).eraseDown()
      }
      this.lines -= n
      if (this.lines < 0) throw new Error(`${n}`)  //assertion error
    }

    const prefix = wprefix
      ? this.prefix
      : flatmap(this.globalPrefix?.chuzzle(), x => `${dark(x)} `) ?? ''
    console.error(prefix + line)
    this.lines += ln(line, wprefix ? this.prefix_length : this.globalPrefix?.length ?? 0)
    this.last_line = line
  }

  clear() {
    if (this.sequences_ok && this.lines && this.verbosity >= 0) {
      this.tty.cursorLeft.cursorUp(this.lines).eraseDown(this.lines)
      this.lines = 0
    }
  }
}

export function logJSON(data: Record<string, unknown>) {
  console.error(JSON.stringify(data));
}
