import { Installation, PackageRequirement } from "types"
import useCellar from "hooks/useCellar.ts"
import usePlatform from "hooks/usePlatform.ts"

type Env = Record<string, string[]>
export const EnvKeys = [
  'PATH',
  'MANPATH',
  'PKG_CONFIG_PATH',
  'LIBRARY_PATH',
  'LD_LIBRARY_PATH',
  'CPATH',
  'XDG_DATA_DIRS',
  'CMAKE_PREFIX_PATH',
  'DYLD_LIBRARY_PATH'
]

interface Response {
  vars: Env
  defaults: Env
  combined: Env
  combinedStrings: Record<string, string>
  pending: PackageRequirement[]
}

export default async function useShellEnv(requirements: PackageRequirement[] | Installation[]): Promise<Response> {
  const cellar = useCellar()
  const vars: Env = {}
  const pending: PackageRequirement[] = []
  const isNotMac = usePlatform().platform != 'darwin'

  const pkgs = (await Promise.all(requirements.map(async rq => {
    if ("constraint" in rq) {
      const installation = await cellar.isInstalled(rq)
      if (!installation) {
        pending.push(rq)
      } else {
        return installation
      }
    } else {
      return rq
    }
  }))).compactMap(x => x)

  const projects = new Set([...pkgs.map(x => x.pkg.project), ...pending.map(x=>x.project)])
  const has_pkg_config = projects.has('freedesktop.org/pkg-config')
  const has_cmake = projects.has('cmake.org')

  for (const installation of pkgs) {
    for (const key of EnvKeys) {
      for (const suffix of suffixes(key)!) {
        if (!vars[key]) vars[key] = []
        vars[key].compactUnshift(installation.path.join(suffix).compact()?.string)
      }
    }

    // if the tool provides no pkg-config files then fall back on old-school specification methods
    if (true) { //!vars.PKG_CONFIG_PATH?.chuzzle() || !has_pkg_config) {
      if (!vars.LIBRARY_PATH) vars.LIBRARY_PATH = []
      if (!vars.CPATH) vars.CPATH = []
      vars.LIBRARY_PATH.compactUnshift(installation.path.join("lib").compact()?.string)
      vars.CPATH.compactUnshift(installation.path.join("include").compact()?.string)
    }

    if (has_cmake) {
      if (!vars.CMAKE_PREFIX_PATH) vars.CMAKE_PREFIX_PATH = []
      vars.CMAKE_PREFIX_PATH.unshift(installation.path.string)
    }
  }

   // needed since on Linux library paths aren’t automatically included when linking
   // so otherwise linked binfiles will not run
   if (vars.LIBRARY_PATH && isNotMac) {
    vars.LD_LIBRARY_PATH = vars.LIBRARY_PATH
  }


  const defaults: Env = {}
  const combined: Env = {}
  const combinedStrings: Record<string, string> = {}
  for (const key of EnvKeys) {
    const defaultValue = Deno.env.get(key)
      ?.split(":")
      ?.filter(x => !x.startsWith("/opt")) ?? [] //FIXME /opt is not ours
    defaults[key] = defaultValue
    combined[key] = (vars[key] ?? []).concat(defaultValue)
    combinedStrings[key] = combined[key].join(":")
  }

  return { vars, defaults, combined, combinedStrings, pending }
}

function suffixes(key: string) {
  switch (key) {
    case 'PATH':
      return ["bin", "sbin"]
    case 'MANPATH':
      return ["share/man"]
    case 'PKG_CONFIG_PATH':
      return ['share/pkgconfig', 'lib/pkgconfig']
    case 'XDG_DATA_DIRS':
      return ['share']
    case 'LIBRARY_PATH':
    case 'LD_LIBRARY_PATH':
    case 'DYLD_LIBRARY_PATH':
    case 'CPATH':
    case 'CMAKE_PREFIX_PATH':
      return []  // we handle these specially
    default:
      throw new Error("unhandled")
  }
}

export function expand(env: Record<string, string[]>) {
  let rv = ''
  for (let [key, value] of Object.entries(env)) {
    if (key == 'PATH') value = value.concat("/usr/bin:/bin:/usr/sbin:/sbin") //FIXME
    if (value.length == 0) continue
    rv += `export ${key}='${value.join(":")}'\n`
  }
  return rv
}
