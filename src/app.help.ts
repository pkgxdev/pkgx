import { useFlags } from "hooks"
import { print, undent } from "utils"

export default async function help() {
  const { verbose } = useFlags()

  // tea -mx +deno.land^1.18 foo.ts -- bar
  // tea -mx +deno.land^1.18 deno -- ./script-file foo bar baz
  // tea build
  // tea -mx ./README.md -- build

  //TODO make the stuff in brackets grayed out a bit

  if (!verbose) {
    //        10|       20|       30|       40|       50|       60|       70| |     80|
    await print(undent`
      usage:
        tea [-xd] [flags] [file|URL|target|cmd|interpreter] [+package~x.y] -- [arg…]

      modes:                                            magical?
  05    𝑜𝑚𝑖𝑡𝑡𝑒𝑑           infer operation                  ✨
        --exec,-x         execute
        --dump,-d         dump

      flags:
  10    --env,-E          inject virtual environment       ✨
        --sync,-S         sync pantries, etc. first        ✨
        --muggle,-m       disable magic
        --verbose,-v      eg. tea -vv
        --silent,-s       no chat, no errors
        --cd,-C           change directory first
  15
      more:
        tea -vh
  18    open github.com/teaxyz/cli
      `)
    //HEYU! did you exceed 22 lines? Don’t! That’s the limit!
  } else {
    //        10|       20|       30|       40|       50|       60|       70| |     80|
    await print(undent`
      usage:
        tea [-xd] [flags] [file|URL|target|cmd|interpreter] [+package~x.y] -- [arg…]

      modes:                                                    magical?  env-aware
        --exec,-x                   execute (omittable if ✨)      ✨         𐄂
        --dump,-d                   dump                           ✨         𐄂

      aliases:
        --help,-h                   --dump=usage
        --version,-v                --dump=version                            𐄂
        --prefix                    --dump=prefix

      flags:
        --env,-E                    inject virtual environment     ✨
        --sync,-S                   sync pantries, etc. first      ✨
        --json,-j                   output json
        --muggle,-m                 disable magic
        --verbose,-v                short form accumulates, shows version first
        --silent,-s                 no chat, no errors
        --cd,-C,--chdir             change directory first

      environment variables:
        VERBOSE           {-1: silent, 0: default, 1: verbose, 2: debug}
        MAGIC             [0,1]
        DEBUG             [0,1]: alias for \`VERBOSE=2\`
        TEA_DIR           \`--chdir \${directory}\`

      notes:
        - explicit flags override any environment variables
        - the results of magic can be observed if verbosity is > 0

      ideology:
        > A successful tool is one that was used to do something undreamed of
        > by its author
          —𝑠ℎ𝑎𝑑𝑜𝑤𝑦 𝑠𝑢𝑝𝑒𝑟 𝑐𝑜𝑑𝑒𝑟
    `)
  }
}
