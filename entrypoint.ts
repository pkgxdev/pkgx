/*
  this file seeks to be the only file that is “impure”
  ie. using the global environment to affect the program
 */

import { render as perror } from "./src/err-handler.ts"
import { setColorEnabled } from "deno/fmt/colors.ts"
import clicolor from "./src/utils/clicolor.ts"

setColorEnabled(clicolor(Deno.stderr.rid))

///////////////////////////////////////////////////////// backwards compatability
const argstr = Deno.args.join(' ')

if (/--hook(=[a-z]+)?/.test(argstr) || argstr == '--env --keep-going --silent --dry-run=w/trace' || argstr == '-Eds' || argstr.endsWith("/magic -Esk --chaste env")) {
  perror('deprecated', 'magic', [
    ['type `pkgx integrate --dry-run` to use our new integrations']
  ], 'https://blog.pkgx.sh/v1')
}
if (parseInt(Deno.env.get("PKGX_LVL")!) >= 10) {
  perror('fatal', 'PKGX_LVL >= 10', [], 'https://github.com/orgs/pkgxdev/discussions/11')
  Deno.exit(2)
}
if (argstr == '--prefix') {
  console.error("%cdeprecated: %cuse ${PKGX_DIR:-$HOME/.pkgx} instead", 'color: red', 'color: initial')
  console.log(Deno.env.get("PKGX_DIR") || Deno.env.get("HOME") + "/.pkgx")
  Deno.exit(0)
}
if (argstr == 'install' || argstr == 'unload') {
  console.error('pkgx: error: shellcode not loaded')
  console.error('pkgx: ^^run: eval "$(pkgx integrate)"')
  Deno.exit(1)
}

//////////////////////////////////////////////////////////////////////////// main
import err_handler from "./src/err-handler.ts"
import parse_args from "./src/parse-args.ts"
import { isNumber } from "is-what"
import app from "./src/app.ts"
import { utils } from "pkgx"
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

  //FIXME ⌄⌄ can’t figure this out
  // deno-lint-ignore no-explicit-any
  await app(args as any, logger_prefix())
} catch (err) {
  const code = err_handler(err)
  Deno.exit(code)
}

/////////////////////////////////////////////////////////////////////////// utils
function logger_prefix() {
  if (Deno.env.get("CI") || !Deno.isatty(Deno.stdin.rid)) {
    return 'pkgx'
  }
}
