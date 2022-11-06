import { usePrefix, useVirtualEnv, useSync } from "hooks"
import * as logger from "hooks/useLogger.ts"
import { useArgs } from "hooks/useFlags.ts"
import dump from "./app.dump.ts"
import exec from "./app.exec.ts"
import help from "./app.help.ts"
import { print, TeaError, UsageError } from "utils"
import X from "./app.X.ts"
import Path from "path"

const [args, {sync, silent, debug}] = useArgs(Deno.args)
const version = `${(await useVirtualEnv({ cwd: new URL(import.meta.url).path().parent() }).swallow(/not-found/))?.version?.toString()}+dev`
// ^^ this is statically replaced at deployment

if (args.cd) {
  const chdir = args.cd
  console.verbose({ chdir })
  Deno.chdir(chdir.string)
}

if (args.mode == "exec" || args.mode == undefined ||  args.mode == "eXec" || !Deno.isatty(Deno.stdout.rid) || Deno.env.get('CI')) {
  logger.set_global_prefix('tea:')
}

try {
  if (sync) {
    await useSync()
  }

  if (args.mode == "exec" || args.mode == undefined) {
    announce()
    await exec(args)
  } else if (args.mode == "eXec") {
    announce()
    await X(args)
  } else switch (args.mode[1]) {
    case "env":
      await dump(args)
      break
    case "help":
      await help()
      break
    case "version":
      await print(`tea ${version}`)
      break
    case "prefix":
      await print(usePrefix().string)
    }
} catch (err) {
  if (silent) {
    Deno.exit(1)
  } else if (err instanceof UsageError) {
    await help()
    Deno.exit(1)
  } else if (err instanceof TeaError) {
    console.error(`${logger.red('error')}: ${err.id} (${logger.gray(err.code())})`)
    console.error(err.message)
    if (debug) console.error(err.ctx)
  } else {
    const title = encodeURIComponent(`panic:${err.message}`).replaceAll('%20', '+')
    const url = `https://github.com/teaxyz/cli/issues/new?title=${title}`

    console.error()
    console.error(`${logger.red("panic")}:`, "split tea. we’re sorry and we’ll fix it… but you have to report the bug!")
    console.error()
    console.error("   ", logger.gray(url))
    console.error()
    console.error("----------------------------------------------------->> attachment begin")
    console.error(logger.gray(err.stack))
    console.error("<<------------------------------------------------------ attachment ends")
  }
}

function announce() {
  const self = new Path(Deno.execPath())
  const prefix = usePrefix().string

  if (self.basename() == "deno") {
    console.verbose({ deno: self.string, prefix, import: import.meta })
  } else {
    console.verbose(`${prefix}/tea.xyz/v${version}/bin/tea`)
  }
}
