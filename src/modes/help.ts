import { dim } from "../utils/color.ts"
import undent from "outdent"

export default function(verbosity = 0) {

  if (verbosity <= 0) {
    //        10|       20|       30|       40|       50|       60|       70| |     80|
    return undent`
      usage:
        pkgx [+pkg@x.y…] <program|path> [--] [arg…]

      examples:
  05    $ pkgx node@18 --eval 'console.log("pkgx.sh")'
        $ pkgx +openssl cargo build
        $ pkgx@latest npx@latest cowsay@latest 'fancy a cuppa?'
        $ env +bun   # https://docs.pkgx.sh/shell-integration

  10  more:
        $ pkgx --help --verbose
        $ open https://docs.pkgx.sh
      `.replaceAll('$', dim('$')).replaceAll(/#.*/g, dim)
  } else {
    //        10|       20|       30|       40|       50|       60|       70| |     80|
    return undent`
      usage:
        pkgx [+pkg@x.y…] <program|path> [--] [arg…]

        • assembles the requested environment, installing packages as necessary
        • automatically determines additional packages based on the args
        • executes program and args in that environment

      flags:
        --sync         #synchronize pantry †
        --update       #update the pkgenv to latest versions w/in constraints
        --verbose[=n]  #set verbosity ‡

       #• repetitions override previous values

       #† typically not needed, we automatically synchronize when appropriate
       #‡ see VERBOSE

      aliases:
        --silent  #no chat, no errors, no output; just exit code (--verbose=-2) §
        --quiet   #minimal chat, errors, & output (--verbose=-1)

       #§ silences pkgx, *not the executed program*

      modes:
        install <pkg…>           #installs stubs to PATH
        uninstall <pkg…>         #uninstall stubs
        integrate [--dry-run]    #integrate with found shells
        deintegrate [--dry-run]  #deintegrates all shell integrations

      alt. modes:
        --help                       #hi mom!
        --version                    #prints pkgx’s version
        --provider <programs…>       #prints provider(s); non-0 exit if none
        --shell-completion <prefix>  #prints completions for /prefix.*/

      environments variables:
        PKGX_DIR  #cache pkgs here, defaults to ~/.pkgx
        VERBOSE   #{-2: silent, -1: quietish, 0: default, 1: verbose, 2: debug}
        DEBUG     #alias for \`VERBOSE=2\`

       #• explicit flags override any environment variables

      environmental influencers:
        CI        #defaults verbosity to -1 (--quiet)
        CLICOLOR  #see https://bixense.com/clicolors
    `.replaceAll(/#(.*)/g, (_,x) => dim(` ${x}`))
  }
}
