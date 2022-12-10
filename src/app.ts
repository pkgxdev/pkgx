import { usePrefix, useRequirementsFile } from "hooks"
import err_handler from "./app.err-handler.ts"
import * as logger from "hooks/useLogger.ts"
import { useArgs } from "hooks/useFlags.ts"
import syncf from "./app.sync.ts"
import dump from "./app.dump.ts"
import exec from "./app.exec.ts"
import help from "./app.help.ts"
import { print } from "utils"
import X from "./app.X.ts"
import Path from "path"
import { Verbosity } from "./types.ts"

const [args, {sync, verbosity}] = useArgs(Deno.args, Deno.execPath())
const version = `${(await useRequirementsFile(new URL(import.meta.url).path().join("../../README.md")).swallow(/not-found/))?.version}+dev`
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
    await syncf(args)
  }

  if (args.mode == "exec" || args.mode == undefined) {
    await announce()
    await exec(args)
  } else if (args.mode == "eXec") {
    await announce()
    await X(args)
  } else switch (args.mode[1]) {
    case "env":
      await dump(args)
      break
    case "help":
      await help()
      break
    case "version":
      await print_version()
      break
    case "prefix":
      await print(usePrefix().string)
    }
} catch (err) {
  await err_handler(err)
  Deno.exit(1)
}

async function announce() {
  const self = new Path(Deno.execPath())
  const prefix = usePrefix().string

  switch (verbosity) {
  case Verbosity.debug:
    if (self.basename() == "deno") {
      console.debug({ deno: self.string, prefix, import: import.meta, tea: version })
    } else {
      console.debug(`${prefix}/tea.xyz/v${version}/bin/tea`)
    }
    break
  case Verbosity.loud:
    await print_version()
  }
}

async function print_version() {
  await print(`tea ${version}`)
}
