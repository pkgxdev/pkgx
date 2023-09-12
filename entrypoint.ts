/*
  this file seeks to be the only file that is “impure”
  ie. using the global environment to affect the program
 */

import { render as perror } from "./src/err-handler.ts"
import { setColorEnabled } from "deno/fmt/colors.ts"

setColorEnabled(clicolor())

///////////////////////////////////////////////////////// backwards compatability
const argstr = Deno.args.join(' ')

if (/--hook(=[a-z]+)?/.test(argstr) || argstr == '--env --keep-going --silent --dry-run=w/trace' || argstr == '-Eds' || argstr == "+tea.xyz/magic -Esk --chaste env") {
  perror('deprecated', 'tea magic', [
    ['type `tea integrate --dry-run` to use our new integrations']
  ], 'https://help.tea.xyz/v0-migration-guide')
}
if (parseInt(Deno.env.get("TEA_LVL")!) >= 10) {
  perror('fatal', 'TEA_LVL >= 10', [], 'https://help.tea.xyz/TEA_LVL')
  Deno.exit(2)
}
if (Deno.env.get("TEA_PREFIX")) {
  if (Deno.env.get("TEA_DIR")) {
    perror('fatal', 'TEA_PREFIX has been renamed TEA_DIR', [
      ['both are set so there is no mitigation strategy']
    ], 'https://help.tea.xyz/v0-migration-guide')
    Deno.exit(3)
  }

  console.error("%cdeprecated: %cTEA_PREFIX has been renamed TEA_DIR, migrate before v1.0.0+gold", 'color: red', 'color: initial')
  Deno.env.set("TEA_DIR", Deno.env.get("TEA_PREFIX")!)
}
if (argstr == '--prefix') {
  console.error("%cdeprecated: %cuse ${TEA_DIR:-$HOME/.tea} instead", 'color: red', 'color: initial')
  console.log(Deno.env.get("TEA_DIR") || Deno.env.get("HOME") + "/.tea")
  Deno.exit(0)
}
if (argstr == 'install' || argstr == 'unload') {
  console.error('tea: error: shellcode not loaded')
  console.error('tea: ^^run: eval "$(tea integrate)"')
  Deno.exit(1)
}

//////////////////////////////////////////////////////////////////////////// main
import err_handler from "./src/err-handler.ts"
import parse_args from "./src/parse-args.ts"
import { isNumber } from "is-what"
import app from "./src/app.ts"
import { utils } from "tea"
const { flatmap } = utils

try {
  const args = parse_args(Deno.args)

  if (args.flags.verbosity === undefined) {
    let shv: number | undefined
    if (Deno.env.get("DEBUG")) {
      args.flags.verbosity = 2
    } else if ((shv = flatmap(Deno.env.get("VERBOSE"), parseInt)) && isNumber(shv)) {
      args.flags.verbosity = shv
    } else if (Deno.env.get("CI")) {
      args.flags.verbosity = -1  // quieter but not silent
    } else {
      args.flags.verbosity = 0
    }
  }

  if (args.flags.verbosity <= -2) {
    console.log = () => {}
    console.error = () => {}
  }

  await app(args as any, logger_prefix())
} catch (err) {
  const code = err_handler(err)
  Deno.exit(code)
}

/////////////////////////////////////////////////////////////////////////// utils
function logger_prefix() {
  if (Deno.env.get("CI") || !Deno.isatty(Deno.stdin.rid)) {
    return 'tea'
  }
}

function clicolor() {
  const env = Deno.env.toObject()

  if ((env.CLICOLOR ?? '1') != '0' && Deno.isatty(Deno.stderr.rid)){
    //https://bixense.com/clicolors/
    //NOTE we (mostly) only output colors to stderr hence the isatty check for that
    //FIXME not true for --help tho
    return true
  }
  if ((env.CLICOLOR_FORCE ?? '0') != '0') {
    //https://bixense.com/clicolors/
    return true
  }
  if ((env.NO_COLOR ?? '0') != '0') {
    return false
  }
  if (env.CLICOLOR == '0' || env.CLICOLOR_FORCE == '0') {
    return false
  }
  if (env.CI) {
    // this is what charm’s lipgloss does, we copy their lead
    // however surely nobody wants `tea foo > bar` to contain color codes?
    // the thing is otherwise we have no color in CI since it is not a TTY
    //TODO probs should check the value of some of the TERM vars
    return true
  }

  return false
}
