import { colors, tty } from "cliffy/ansi/mod.ts"
import { flatmap } from "../utils/index.ts";
import useFlags from "./useFlags.ts"

let global_prefix: string | undefined
export function set_global_prefix(prefix: string) {
  if (global_prefix !== undefined) throw new Error()
  global_prefix = prefix.trim()
}

// ref https://github.com/chalk/ansi-regex/blob/main/index.js
const ansi_escapes_rx = new RegExp([
  '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
  '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))'
].join('|'), 'g')

function ln(s: string, prefix_length: number) {
  try {
    // remove ansi escapes to get actual length
    const n = s.replace(ansi_escapes_rx, '').length + prefix_length
    const { columns } = Deno.consoleSize()
    return Math.ceil(n / columns)
  } catch {
    // consoleSize() throws if not a tty
    // eg. in GitHub Actions
    return 1
  }
}

export default function useLogger(prefix?: string) {
  return new Logger(prefix)
}

function colorIfTTY(x: string, colorMethod: (x: string)=>string) {
  //TODO this function needs to take a out/err parameter since that's what
  // needs to be tested rather than testing for both (this is safe for now)
  const isTTY = () => Deno.isatty(Deno.stdout.rid) && Deno.isatty(Deno.stdout.rid)

  const color_on = () => {
    if ((Deno.env.get("CLICOLOR") ?? '1') != '0' && isTTY()){
      //https://bixense.com/clicolors/
      return true
    }
    if ((Deno.env.get("CLICOLOR_FORCE") ?? '0') != '0') {
      //https://bixense.com/clicolors/
      return true
    }
    if ((Deno.env.get("NO_COLOR") ?? '0') != '0') {
      return false
    }
    if (Deno.env.get("CLICOLOR") == '0' || Deno.env.get("CLICOLOR_FORCE") == '0') {
      return false
    }
    if (Deno.env.get("CI")) {
      // this is what charm’s lipgloss does, we copy their lead
      // however surely nobody wants `tea foo > bar` to contain color codes?
      // the thing is otherwise we have no color in CI since it is not a TTY
      return true
    }
  }

  return color_on() ? colorMethod(x) : x
}

export const teal = (x: string) => colorIfTTY(x, (x) => colors.rgb8(x, 86))
export const red = (x: string) => colorIfTTY(x, colors.brightRed)
export const gray = (x: string) => colorIfTTY(x, (x) => colors.rgb8(x, 244))
export const dark = (x: string) => colorIfTTY(x, (x) => colors.rgb8(x, 238))
export const lite = (x: string) => colorIfTTY(x, (x) => colors.rgb8(x, 252))

export class Logger {
  readonly prefix: string
  lines = 0
  last_line = ''
  tty = tty({ stdout: Deno.stderr })
  verbosity = useFlags().verbosity
  prefix_length: number

  constructor(prefix?: string) {
    prefix = prefix?.chuzzle()
    this.prefix_length = prefix?.length ?? 0
    this.prefix = prefix ? `${gray(prefix)} ` : ''
    if (global_prefix) {
      this.prefix = `${dark(global_prefix)} ${this.prefix}`
      this.prefix_length += global_prefix.length + 1
    }
  }

  //TODO don’t erase whole lines, just erase the part that is different
  replace(line: string, {prefix: wprefix}: {prefix: boolean} = {prefix: true}) {
    if (this.verbosity < 0) return

    if (line == this.last_line) {
      return  //noop
    }

    if (this.lines) {
      const n = ln(this.last_line, this.prefix_length)
      if (this.verbosity < 1) {
        this.tty.cursorLeft.cursorUp(n).eraseDown()
      }
      this.lines -= n
      if (this.lines < 0) throw new Error(`${n}`)  //assertion error
    }

    const prefix = wprefix
      ? this.prefix
      : flatmap(global_prefix?.chuzzle(), x => `${dark(x)} `) ?? ''
    console.error(prefix + line)
    this.lines += ln(line, wprefix ? this.prefix_length : global_prefix?.length ?? 0)
    this.last_line = line
  }

  clear() {
    if (this.lines && this.verbosity >= 0) {
      this.tty.cursorLeft.cursorUp(this.lines).eraseDown(this.lines)
      this.lines = 0
    }
  }
}
