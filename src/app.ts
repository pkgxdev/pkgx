import { usePrefix, useExec, useVirtualEnv, useVersion, useErrorHandler } from "hooks"
import * as logger from "hooks/useLogger.ts"
import useFlags, { Args, useArgs } from "hooks/useFlags.ts"
import syncf from "./app.sync.ts"
import dump from "./app.dump.ts"
import help from "./app.help.ts"
import provides from "./app.provides.ts";
import magic from "./app.magic.ts"
import exec, { repl } from "./app.exec.ts"
import { print, pkg as pkgutils, flatmap, UsageError } from "utils"
import Path from "path"
import { Verbosity } from "./types.ts"
import * as semver from "semver"
import { VirtualEnv } from "./hooks/useVirtualEnv.ts"

try {
  const [args] = useArgs(Deno.args, Deno.execPath())

  if (args.cd) {
    const chdir = args.cd
    console.verbose({ chdir })
    Deno.chdir(chdir.string)
  }

  const syringe = await injection(args)

  if (args.sync) {
    await syncf(args.pkgs, syringe)
  }

  if (!Deno.isatty(Deno.stdout.rid) || Deno.env.get('CI')) {
    logger.set_global_prefix('tea:')
  }

  switch (args.mode) {
  case "std": {
    announce()

    const wut_ = wut(args)

    const venv = await injection(args)
    const {cmd, env, pkgs, installations} = await useExec({...args, inject: venv})

    const full_path = () => [...env["PATH"]?.split(':') ?? [], ...Deno.env.get('PATH')?.split(':') ?? []].uniq()

    switch (wut_) {
    case 'exec':
      env['PATH'] = full_path().join(':')
      await exec(cmd, env)
      break
    case 'dryrun': {
      if (cmd.length) {
        //TODO really we should use the same function that deno does or this is not guaranteed the same result
        cmd[0] = full_path().map(x => Path.cwd().join(x, cmd[0])).find(x => x.isExecutableFile())?.string ?? cmd[0]
      }
      //TODO proper shell escaping
      const output = cmd.join(" ").trim()
      if (output) {
        await print(output)
      }
    } break
    case 'repl':
      env['PATH'] = full_path().join(':')
      await repl(installations, env)
      break
    case 'env':
      if (pkgs.length == 0) {
        if (Deno.args.length == 0) {
          console.error("tea: empty pkg env (see: `tea --help`)")
        } else {
          console.error("tea: empty pkg env")
        }
      } else for (const key in env) {
        const inferred = env[key].split(":")
        const inherited = Deno.env.get(key)?.split(":") ?? []
        const value = [...inferred, ...inherited].uniq()
        await print(`${key}=${value.join(":")}`)
      }
      break
    case "dump":
      env['PATH'] = full_path().join(':')
      env["TEA_PKGS"] = pkgs.map(pkgutils.str).join(":")
      env["TEA_PREFIX"] ??= usePrefix().string
      env["TEA_VERSION"] = useVersion()

      await dump({env, pkgs: installations})
      break
    }
  } break
  case "help":
    await help()
    break
  case "version":
    await print(`tea ${useVersion()}`)
    break
  case "prefix":
    await print(usePrefix().string)
    break
  case "provides":
    await provides(args.args)
    break
  default:
    await print(magic(new Path(Deno.execPath()), args.mode[1]))
  }
} catch (err) {
  if (err instanceof UsageError) {
    if (!useFlags().silent) await help()
    Deno.exit(1)
  } else {
    const code = await useErrorHandler(err)
    Deno.exit(code)
  }
}

function announce() {
  const self = new Path(Deno.execPath())
  const prefix = usePrefix().string
  const version = useVersion()

  switch (useFlags().verbosity) {
  case Verbosity.debug:
    if (self.basename() == "deno") {
      console.debug({ deno: self.string, prefix, import: import.meta, tea: version })
    } else {
      console.debug(`${prefix}/tea.xyz/v${version}/bin/tea`)
    }
    break
  case Verbosity.loud:
    console.error(`tea ${useVersion()}`)
  }
}

function injection({ args, inject }: Args) {
  const TEA_PKGS = Deno.env.get("TEA_PKGS")

  //TODO if TEA_PKGS then extract virtual-env from that, don’t reinterpret it

  if (inject) {
    // the environment location is calculated based on arg0 if it is a file
    // this so scripts can find their env if they have one, precedent: deno finding its deno.json
    //NOTE: this is possibly not a good idea

    let cwd = Path.cwd()
    const file = cwd.join(args[0])
    if (file.isReadableFile()) {
      //TODO ONLY FOR SCRIPTS LOL so `tea /bin/ls` shouldn’t env to /bin
      cwd = file.parent()
    }

    if (useFlags().keep_going) {
      return useVirtualEnv(cwd).swallow(/^not-found/)
    } else if (TEA_PKGS) {
      /// if an env is defined then we still are going to try to read it
      /// because `-E` was explicitly stated, however if we fail then
      /// we’ll delegate to the env we previously defined
      return useVirtualEnv(cwd).catch(err => {
        try {
          return from_env()
        } catch {
          throw err
        }
      })
    } else {
      return useVirtualEnv(cwd)
    }
  } else if (TEA_PKGS && inject !== false) {
    return from_env()
  }

  function from_env(): VirtualEnv | undefined {
    const { TEA_FILES, SRCROOT, VERSION } = Deno.env.toObject()
    if (!TEA_FILES || !TEA_PKGS || !SRCROOT) return
    //TODO anything that isn’t an absolute path will crash
    return {
      env: {},
      pkgs: TEA_PKGS!.split(":").map(pkgutils.parse),
      teafiles: TEA_FILES.split(":").map(x => new Path(x)),
      srcroot: new Path(SRCROOT),
      version: flatmap(VERSION, semver.parse)
    }
  }
}


function wut(args: Args): 'dump' | 'exec' | 'repl' | 'env' | 'dryrun' {

  // HACK until we split this out into its own pkg/cmd
  const stack_mode = (() => {
    if (args.pkgs.length != 1) return false
    if (args.pkgs[0].project != "tea.xyz/magic") return false
    if (args.args.length != 1) return false
    if (args.args[0] != "env") return false
    args.pkgs = []
    args.args = []
    return true
  })()

  if (useFlags().dryrun) {
    return 'dryrun'
  } else if (stack_mode) {
    return 'dump'
  } else if (args.args.length == 1 && args.args[0] == 'sh') {
    return 'repl'
  } else if (args.args.length == 0) {
    return 'env'
  } else {
    return 'exec'
  }
}
