import { PackageRequirement } from "types"
import useCellar from "hooks/useCellar.ts"

type Env = Record<string, string[]>
export const EnvKeys = [
  'PATH',
  'MANPATH',
  'PKG_CONFIG_PATH',
  'LIBRARY_PATH',
  'CPATH',
  'XDG_DATA_DIRS',
  'CMAKE_PREFIX_PATH'
]

interface Response {
  vars: Env
  defaults: Env
  combined: Env
  combinedStrings: Record<string, string>
  pending: PackageRequirement[]
}

//TODO | Installation[] (quicker)

export default async function useShellEnv(requirements: PackageRequirement[]): Promise<Response> {
  const cellar = useCellar()
  const vars: Env = {}
  const pending: PackageRequirement[] = []

  for (const requirement of requirements) {
    const installation = await cellar.resolve(requirement).swallow(/^not-found:/)

    if (!installation) {
      pending.push(requirement)
    } else for (const key of EnvKeys) {
      for (const suffix of suffixes(key)!) {
        if (!vars[key]) vars[key] = []
        vars[key].compactUnshift(installation.path.join(suffix).compact()?.string)
      }

      // if the tool provides no pkg-config files then fall back on old-school specification methods
      if (!vars.PKG_CONFIG_PATH?.chuzzle()) {
        vars.LIBRARY_PATH = []
        vars.CPATH = []
        vars.LIBRARY_PATH.compactUnshift(installation.path.join("lib").compact()?.string)
        vars.CPATH.compactUnshift(installation.path.join("include").compact()?.string)
      }

      //TODO only if cmake is in deps
      if (!vars.CMAKE_PREFIX_PATH) vars.CMAKE_PREFIX_PATH = []
      vars.CMAKE_PREFIX_PATH.unshift(installation.path.string)

      //TODO PKG_CONFIG_PATH only if pkg-config is in deps
    }
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
    case 'LIBRARY_PATH':
    case 'CPATH':
      return []  // we handle these specially
    case 'XDG_DATA_DIRS':
      return ['share']
    default:
      return []
  }
}
