import { colors, tty } from "cliffy/ansi/mod.ts"

//TODO need to truncate to end of line OR know to replace more than one line

export default function useLogger(prefix?: string) {
  return new Logger(prefix)
}

export const teal = (x: string) => colors.rgb8(x, 86);
export const red = colors.brightRed

export class Logger {
  readonly prefix: string
  lines = 0
  last_line = ''

  constructor(prefix?: string) {
    this.prefix = prefix ? colors.gray(`${prefix}:`) : ''
  }

  replace(line: string) {
    if (line == this.last_line) return

    if (this.lines) {
      tty.cursorLeft.cursorUp(1).eraseDown()
      this.lines--
    }
    console.info(this.prefix, line)
    this.lines++
    this.last_line = line
  }

  clear() {
    tty.cursorLeft.cursorUp(this.lines).eraseDown(this.lines)
    this.lines = 0
  }
}
