import { plumbing, utils, hooks, PackageSpecification, Installation, Path, semver, TeaError } from "tea"
import { useYAMLFrontMatter, VirtualEnv, useConfig } from "hooks"
import base_which from "tea/plumbing/which.ts"
import install from "../prefab/install.ts"
import undent from "outdent"

const { usePantry, useCellar, useDownload, useShellEnv } = hooks
const { hydrate } = plumbing

interface Parameters {
  args: string[]
  pkgs: PackageSpecification[]
  inject?: VirtualEnv
  sync: boolean
  chaste: boolean
}

class AmbiguityError extends TeaError {
  projects: string[]

  constructor(arg0: string, projects: string[]) {
    super(undent`
      multiple projects provide \`${arg0}\`. please be more specific:

      ${projects.map(p => `    tea +${p} ${Deno.args.join(' ')}`).join('\n')}
      `)
    this.projects = projects
  }
}

export default async function({ pkgs, inject, sync, ...opts }: Parameters) {
  let cmd = [...opts.args]
  const arg0 = await fetch_it(cmd[0])
  if (arg0) cmd[0] = arg0?.toString()  // if we downloaded it then we need to replace args[0]
  const clutch = pkgs.length > 0
  const env: Record<string, string> = inject?.env ?? {}
  const sh = useShellEnv()

  if (inject) {
    const {version, srcroot, teafiles, ...vrtenv} = inject
    if (version) env["VERSION"] = version.toString()
    env["SRCROOT"] = srcroot.toString()
    env["TEA_FILES"] = teafiles.join(":")
    pkgs.push(...vrtenv.pkgs)
  }

  if (arg0 instanceof Path && arg0.isFile()) {

    const precmd: string[] = []

    const yaml = await useYAMLFrontMatter(arg0, inject?.srcroot)
    if (yaml) {
      precmd.unshift(...yaml.args)
      Object.assign(env, yaml.env)  //FIXME should override env from pkgs
      pkgs.push(...yaml.pkgs)
    }

    const shebang_args = await read_shebang(arg0)
    const is_tea_shebang = shebang_args[0] == 'tea'
    if (shebang_args.length) {
      if (is_tea_shebang) {
        do {
          shebang_args.shift()
        } while (shebang_args[0]?.startsWith('-'))
      }
      precmd.unshift(...shebang_args)
    }

    if (precmd.length == 0) {
      const found = await usePantry().which({ interprets: arg0.extname() })
      if (found) {
        pkgs.push({ ...found, constraint: new semver.Range('*') })
        precmd.unshift(...found.args)
        await add_companions(found)
      } else if (is_tea_shebang) {
        if (arg0.extname() == '.sh') {
          precmd.unshift("sh")
        } else {
          throw new TeaError(`confused: interpreter: ${arg0}`)
        }
      }
    } else {
      const found = await which(precmd[0])
      if (found) {
        pkgs.push(found)
        await add_companions(found)
      }
    }

    cmd.unshift(...precmd)

  } else if (!clutch && !(arg0 instanceof Path)) {
    const found = await which(arg0)
    if (found) {
      pkgs.push(found)
      cmd = [...found.shebang, ...cmd.slice(1)]
      await add_companions(found)
    }
  }

  let installations: Installation[]
  if (!opts.chaste) {
    const { installed, dry } = await install(pkgs, sync)
    installations = installed
    pkgs = dry  // reassign as condensed + sorted
  } else {
    const cellar = useCellar()
    const { pkgs: wet, dry } = await hydrate(pkgs)
    installations = (await Promise.all(wet.map(cellar.has))).compact()
    pkgs = dry  // reassign as condensed + sorted
  }

  Object.assign(env, sh.flatten(await sh.map({ installations })))

  env["TEA_PREFIX"] ??= useConfig().prefix.string

  return { env, cmd, installations, pkgs }

  async function add_companions(pkg: {project: string}) {
    pkgs.push(...await usePantry().project(pkg).companions())
  }
}


///////////////////////////////////////////////////////////////////////////// funcs

import { readLines } from "deno/io/read_lines.ts"

async function read_shebang(path: Path): Promise<string[]> {
  const f = await Deno.open(path.string, { read: true })
  const line = (await readLines(f).next()).value as string
  let shebang = line.match(/^#!\/usr\/bin\/env (-\S+ )?(.*)$/)?.[2]
  if (shebang) {
    return shebang.split(/\s+/).filter(x => x)
  }

  // allowing leading whitespace since it seems pretty common in the wild
  shebang = line.match(/^\s*#!(.*)$/)?.[1]
  if (shebang) {
    const args = shebang.split(/\s+/).filter(x => x)
    const arg0 = Path.abs(args.shift() ?? '')?.basename()
    if (!arg0) throw new TeaError(`couldn’t figure out shebang: ${path}`, {line, path})
    return [arg0, ...args]
  }

  return []
}

async function fetch_it(arg0: string | undefined) {
  if (!arg0) return

  const url = urlify(arg0)
  if (url) {
    const path = await useDownload().download({ src: url })
    return path.chmod(0o700)  //FIXME like… I don’t feel we should necessarily do this…
  }

  const { arg0: execPath } = useConfig()
  const path = Path.cwd().join(arg0)
  if (path.exists() && execPath.basename() == "tea") {
    // ^^ in the situation where we are shadowing other tool names
    // we don’t want to fork bomb if the tool in question is in CWD

    if (path.extname() == '' && !arg0.includes("/")) {
      // for this case we require ./
      // see: https://github.com/teaxyz/cli/issues/335#issuecomment-1402293358
      return arg0
    }

    return path
  } else {
    return arg0
  }
}

function urlify(arg0: string) {
  try {
    const url = new URL(arg0)
    // we do some magic so GitHub URLs are immediately usable
    switch (url.host) {
    case "github.com":
      url.host = "raw.githubusercontent.com"
      url.pathname = url.pathname.replace("/blob/", "/")
      break
    case "gist.github.com":
      url.host = "gist.githubusercontent.com"
      //FIXME this is not good enough
      // for multifile gists this just gives us a bad URL
      //REF: https://gist.github.com/atenni/5604615
      url.pathname += "/raw"
      break
    }
    return url
  } catch {
    //noop
  }
}

export async function which(arg0: string | undefined) {
  if (!arg0) return
  const { TEA_MAGIC } = useConfig().env
  const abracadabra = TEA_MAGIC?.split(":").includes("abracadabra")
  ///FIXME is slow to scan all package.ymls twice :/
  if (!abracadabra) {
    const found = await base_which(`tea-${arg0}`, { providers: false })
    if (found) return found
  }

  const pkgopts = await base_which(arg0, { providers: true, all: true })
  if (!pkgopts) return

  if (pkgopts.length > 1) {
    throw new AmbiguityError(arg0, pkgopts.map(x => x.project))
  }

  const [found] = pkgopts

  const inenv = useConfig().env.TEA_PKGS?.split(":").map(utils.pkg.parse).find(x => x.project == found.project)
  if (inenv) {
    found.constraint = inenv.constraint
  }

  return found
}
