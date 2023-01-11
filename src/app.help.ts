import { useFlags } from "hooks"
import { print, undent } from "utils"

export default async function help() {
  const { verbose } = useFlags()

  if (!verbose) {
    //        10|       20|       30|       40|       50|       60|       70| |     80|
    await print(undent`
      usage:
        tea [-SEn] [+package~x.y…] [cmd|file|URL] [--] [arg…]

      examples:
  05    $ tea node^19 --eval 'console.log("tea.xyz")'
        $ tea +nodejs.org man node

      flags:
        --sync,-S       sync and update environment packages
  10    --env,-E        inject local environment
        --dry-run,-n    don’t execute, just print

      more:
        $ tea --verbose --help
  15    $ open github.com/teaxyz/cli
      `)
  } else {
    //        10|       20|       30|       40|       50|       60|       70| |     80|
    await print(undent`
      usage:
        tea [-SEnkhvs] [+package~x.y…] [cmd|file|URL] [--] [arg…]

        • constructs the requested environment, installing packages as necessary
        • magically determines additional packages based on the args
        • executes args in that environment

      flags:
        --sync,-S                synchronize and update the environment packages
        --env,-E                 inject the local environment
        --dry-run,-n             don’t execute, just print
        --keep-going,-k          keep going as much as possible after errors
        --verbose,-v             print version and then increase verbosity ‡
        --silent,-s              no chat, no error messages (aka --verbose=-1)
        --cd,-C,--chdir <dir>    change directory first

        • repetitions override previous values
        • long form boolean flags can be assigned, eg. --env=no

        ‡ the short form accumulates, so \`-vv\` is more verbose

      alt. modes:
        --help,-h
        --version,-v      prints tea’s version
        --prefix          prints the tea prefix †

        † all packages are “stowed” in the tea prefix, eg. ~/.tea/rust-lang.org/v1.65.0

      environment variables:
        TEA_PREFIX    stow packages here
        TEA_MAGIC     [0,1] if shell magic is active, \`TEA_MAGIC=0\` disables it
        VERBOSE       {-1: silent, 0: default, 1: verbose, 2: debug}
        DEBUG         [0,1]: alias for \`VERBOSE=2\`

        • explicit flags override any environment variables

      ideology:
        │ A successful tool is one that was used to do something undreamed of
        │ by its author
          —𝑠ℎ𝑎𝑑𝑜𝑤𝑦 𝑠𝑢𝑝𝑒𝑟 𝑐𝑜𝑑𝑒𝑟
    `)
  }
}
