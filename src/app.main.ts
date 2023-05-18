import { usePrefix, useExec, useVirtualEnv, useVersion, usePrint, useConfig } from "hooks"
import { VirtualEnv } from "./hooks/useVirtualEnv.ts"
import { Verbosity } from "./hooks/useConfig.ts"
import { basename } from "deno/path/mod.ts"
import exec, { repl } from "./app.exec.ts"
import { Path, utils, semver, hooks } from "tea"
import provides from "./app.provides.ts"
import magic from "./app.magic.ts"
import dump from "./app.dump.ts"
import help from "./app.help.ts"
import { Args } from "./args.ts"
const { flatmap } = utils
const { useSync } = hooks

export async function run(args: Args) {
  const { print } = usePrint()
  const { arg0: execPath, env: { PATH, SHELL } } = useConfig()

  if (args.cd) {
    const chdir = args.cd
    console.log({ chdir })
    Deno.chdir(chdir.string)
  }

  if (args.sync) {
    await useSync()
  }

  switch (args.mode) {
  case "std": {
    announce(execPath)

    const wut_ = wut(args)

    const venv = await injection(args)
    const {cmd, env, pkgs, installations} = await useExec({...args, inject: venv})

    const full_path = () => [...env["PATH"]?.split(':') ?? [], ...PATH?.split(':') ?? []].uniq()

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
    case "dump": {
      env['PATH'] = full_path().join(':')
      env["TEA_PKGS"] = pkgs.map(utils.pkg.str).join(":").trim()
      env["TEA_PREFIX"] ??= usePrefix().string
      env["TEA_VERSION"] = useVersion()

      const shell = flatmap(SHELL, basename)
      await dump({env, shell})
    } break
  }} break
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
    await print(magic(execPath, args.mode[1]))
  }
}

function announce(self: Path) {
  const prefix = usePrefix().string
  const version = useVersion()

  switch (useConfig().modifiers.verbosity) {
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
  const { TEA_FILES, TEA_PKGS, SRCROOT, VERSION } = useConfig().env
  const teaPkgs = TEA_PKGS?.trim()
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

    if (useConfig().modifiers.keepGoing) {
      return useVirtualEnv(cwd).swallow(/^not-found/)
    } else if (teaPkgs) {
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
  } else if (teaPkgs && inject !== false) {
    return from_env()
  }

  function from_env(): VirtualEnv | undefined {
    if (!TEA_FILES || !TEA_PKGS || !SRCROOT) return
    //TODO anything that isn’t an absolute path will crash
    return {
      env: {},
      pkgs: TEA_PKGS!.split(":").map(utils.pkg.parse),
      teafiles: TEA_FILES.split(":").map(x => new Path(x)),
      srcroot: new Path(SRCROOT),
      version: flatmap(VERSION, semver.parse)
    }
  }
}


export function wut(args: Args): 'dump' | 'exec' | 'repl' | 'env' | 'dryrun' {

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

  if (useConfig().modifiers.dryrun) {
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
