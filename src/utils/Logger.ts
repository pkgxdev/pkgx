import { dim as gray, rgb8, bgRgb8, stripColor } from "deno/fmt/colors.ts"
import { ansi } from "cliffy/ansi/ansi.ts"

export const teal = (x: string) => rgb8(x, 86)
export { gray }

export const inverse_teal = (x: string) => bgRgb8(x, 86)

export default class Logger {
  lines = 0
  prefix?: string

  constructor(prefix?: string) {
    this.prefix = prefix ? `${prefix}: ` : undefined
  }

  //TODO don’t erase whole lines, just erase the part that is different
  replace(line: string, opts: { prefix: boolean } = {prefix: true}) {
    if (opts.prefix && this.prefix) {
      line = `${gray(this.prefix)}${line}`
    }

    Deno.stderr.writeSync(this._clear().text(line).bytes())
    this.lines += ln(line)
  }

  private _clear() {
    try {
      let rv = ansi.eraseLineStart.cursorTo(0)
      if (this.lines > 0) {
        rv = rv.cursorUp(this.lines).eraseDown(this.lines)
      }
      return rv
    } finally {
      this.lines = 0
    }
  }

  clear() {
    Deno.stderr.writeSync(this._clear().bytes())
    this.lines = 0
  }

  newln() {
    console.error()
    this.lines = 0
  }
}

function ln(s: string) {
  try {
    const { columns } = Deno.consoleSize()
    if (columns == 0) return 0
    // remove ansi escapes to get actual length
    const n = stripColor(s).length
    return Math.floor(n / columns)
  } catch {
    // consoleSize() throws if not a tty
    // eg. in GitHub Actions
    return 1
  }
}
