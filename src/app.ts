import { usePrefix, useRequirementsFile, useExec, useVirtualEnv } from "hooks"
import err_handler from "./app.err-handler.ts"
import * as logger from "hooks/useLogger.ts"
import useFlags, { Args, useArgs } from "hooks/useFlags.ts"
import syncf from "./app.sync.ts"
import dump from "./app.dump.ts"
import help from "./app.help.ts"
import magic from "./app.magic.ts"
import exec, { repl } from "./app.exec.ts"
import { print, UsageError } from "utils"
import Path from "path"
import { Verbosity } from "./types.ts"

const version = `${(await useRequirementsFile(new URL(import.meta.url).path().join("../../README.md")).swallow(/not-found/))?.version}+dev`
// ^^ this is statically replaced at deployment

try {
  const [args, {dryrun, verbosity}] = useArgs(Deno.args, Deno.execPath())

  if (args.cd) {
    const chdir = args.cd
    console.verbose({ chdir })
    Deno.chdir(chdir.string)
  }

  const syringe = args.mode == 'exec' || args.sync ? await injection(args) : undefined

  if (args.sync) {
    await syncf(args.pkgs, syringe)
  }

  switch (args.mode) {
  case "exec": {
    if (!Deno.isatty(Deno.stdout.rid) || Deno.env.get('CI')) {
      logger.set_global_prefix('tea:')
    }
    await announce()
    const {cmd, env, pkgs} = await useExec({...args, inject: syringe})
    if (dryrun) {
      await dump({args: cmd, env, pkgs, stack_mode: dryrun == 'w/trace'})
    } else if (cmd.length === 0) {
      if (!args.pkgs.length && args.sync) Deno.exit(0)    // `tea -S` is not an error or a repl
      if (!args.pkgs.length && verbosity > 0) Deno.exit(0) // `tea -v` is not an error or a repl
      if (!args.pkgs.length) throw new UsageError()

      await repl(pkgs, env)

    } else {
      await exec(cmd, env)
    }
  } break
  case "help":
    await help()
    break
  case "version":
    await print_version()
    break
  case "prefix":
    await print(usePrefix().string)
    break
  case "magic":
    await print(magic(new Path(Deno.execPath())))
  }
} catch (err) {
  await err_handler(err)
  Deno.exit(1)
}

async function announce() {
  const self = new Path(Deno.execPath())
  const prefix = usePrefix().string

  switch (useFlags().verbosity) {
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

function injection({ args, inject }: Args) {

  // the environment location is calculated based on arg0 if it is a file
  // this so scripts can find their env if they have one, precedent: deno finding its deno.json
  //NOTE: this is possibly not a good idea
  let cwd = Path.cwd()
  const file = cwd.join(args[0])
  if (file.isReadableFile()) {
    cwd = file.parent()
  }

  if (!inject) {
    return
  } else if (useFlags().keep_going) {
    return useVirtualEnv({ cwd }).swallow(/^not-found/)
  } else {
    return useVirtualEnv({ cwd })
  }
}