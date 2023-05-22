import { Verbosity } from "./hooks/useConfig.ts"
import { usePrint } from "hooks"
import undent from "outdent"

export default async function help(verbosity = Verbosity.normal) {
  const { print } = usePrint()

  if (verbosity < Verbosity.loud) {
    //        10|       20|       30|       40|       50|       60|       70| |     80|
    await print(undent`
      usage:
        tea [-SEn] [+package~x.y…] [cmd|file|URL] [--] [arg…]

      examples:
  05    $ tea node^19 --eval 'console.log("tea.xyz")'
        $ tea +nodejs.org man node
        $ tea +bun.sh sh
        # ^^ try out bun in an containerized shell

  10  flags:
        --sync,-S       sync and update environment packages
        --env,-E        inject local environment
        --dry-run,-n    don’t do anything, just print

  15  more:
        $ tea --verbose --help
        $ open https://docs.tea.xyz
      `)
  } else {
    //        10|       20|       30|       40|       50|       60|       70| |     80|
    await print(undent`
      usage:
        tea [-SEnkhvs] [+package~x.y…] [cmd|file|URL] [--] [arg…]

        • assembles the requested environment, installing packages as necessary
        • magically determines additional packages based on the args
        • executes args in that environment

      flags:
        --sync,-S                synchronize and update the environment packages
        --env,-E                 inject the local environment
        --dry-run,-n             don’t do anything, just print
        --keep-going,-k          keep going as much as possible after errors
        --verbose,-v             print version and then increase verbosity †
        --silent,-s              no chat, no errors: only output the requested data
        --cd,-C,--chdir <dir>    change directory first
        --chaste                 abstain from networking, installing packages, etc.
        --dry-run,-n             don’t execute, just print

        • repetitions override previous values
        • long form boolean flags can be assigned, eg. --env=no

        † the short form accumulates, so \`-vv\` is more verbose

      alt. modes:
        --help,-h
        --version,-v      prints tea’s version
        --prefix          prints the tea prefix ‡
        --provides        exits successfully if package/s are provided

        ‡ all packages are “stowed” in the tea prefix, eg. ~/.tea/rust-lang.org/v1.65.0

      environment variables:
        TEA_PREFIX    stow packages here
        TEA_MAGIC     \`0\` force disables magic, \`prompt\` confirms installs
        CLICOLOR      see https://bixense.com/clicolors
        VERBOSE       {-1: silent, 0: default, 1: verbose, 2: debug}
        DEBUG         alias for \`VERBOSE=2\`

        • explicit flags override any environment variables

      ideology:
        │ a successful tool is one that was used to do something undreamed of
        │ by its author
          —𝘚𝘵𝘦𝘱𝘩𝘦𝘯 𝘊. 𝘑𝘰𝘩𝘯𝘴𝘰𝘯
    `)
  }
}
