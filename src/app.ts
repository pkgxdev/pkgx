import { usePrefix, useVirtualEnv, useSync } from "hooks"
import * as logger from "hooks/useLogger.ts"
import { useArgs } from "hooks/useFlags.ts"
import dump from "./app.dump.ts"
import exec from "./app.exec.ts"
import help from "./app.help.ts"
import { print } from "utils"
import Path from "path"

const [args, {sync, silent}] = useArgs(Deno.args)
const version = `${(await useVirtualEnv({ cwd: new URL(import.meta.url).path().parent() }).swallow(/not-found/))?.version?.toString()}+dev`
// ^^ this is statically replaced at deployment

if (args.cd) {
  const chdir = args.cd
  console.verbose({ chdir })
  Deno.chdir(chdir.string)
}

if (args.mode == "exec" || args.mode == undefined || !Deno.isatty(Deno.stdout.rid) || Deno.env.get('CI')) {
  logger.set_global_prefix('tea:')
}

try {
  if (sync) {
    await useSync()
  }

  if (args.mode == "exec" || args.mode == undefined) {
    announce()
    await exec(args)
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
  } else {
    throw err
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
