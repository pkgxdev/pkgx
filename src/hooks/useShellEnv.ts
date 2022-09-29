import { Installation, PackageRequirement } from "types"
import { usePrefix } from "hooks"
import { host } from "utils"

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
}

export default function useShellEnv(installations: Installation[], pending: PackageRequirement[] = []): Response {
  const vars: Env = {}
  const isMac = host().platform == 'darwin'

  const projects = new Set([...installations.map(x => x.pkg.project), ...pending.map(x=>x.project)])
  const has_cmake = projects.has('cmake.org')
  const archaic = true

  for (const installation of installations) {
    for (const key of EnvKeys) {
      for (const suffix of suffixes(key)!) {
        if (!vars[key]) vars[key] = []
        vars[key].compact_unshift(installation.path.join(suffix).compact()?.string)
      }
    }

    if (archaic) {
      if (!vars.LIBRARY_PATH) vars.LIBRARY_PATH = []
      if (!vars.CPATH) vars.CPATH = []
      vars.LIBRARY_PATH.compact_unshift(installation.path.join("lib").compact()?.string)
      vars.CPATH.compact_unshift(installation.path.join("include").compact()?.string)
    }

    if (has_cmake) {
      if (!vars.CMAKE_PREFIX_PATH) vars.CMAKE_PREFIX_PATH = []
      vars.CMAKE_PREFIX_PATH.unshift(installation.path.string)
    }

    if (projects.has('gnu.org/autoconf')) {
      vars.ACLOCAL_PATH ??= []
      vars.ACLOCAL_PATH.compact_unshift(installation.path.join("share/aclocal").compact()?.string)
    }
  }

   // needed since on Linux library paths aren’t automatically included when linking
   // so otherwise linked binfiles will not run
   if (vars.LIBRARY_PATH) {
    vars.LD_LIBRARY_PATH = vars.LIBRARY_PATH
    if (isMac) {
      vars.DYLD_LIBRARY_PATH = vars.LIBRARY_PATH
    }
  }

  //FIXME figure out correct tea-path not assuming 'v*'
  const tea = usePrefix().join('tea.xyz/v*/bin')
  //FIXME we add these paths so “binutils” and POSIX-utils are available
  // but these PATHs will almost certainly contain other things that will
  // interfere with our ability to create reproducibility
  //NOTE /usr/local/bin is explicitly NOT ADDED
  //TODO provide stub packages that exec the actual tools so we can exclude these PATHs
  if (!vars.PATH) vars.PATH = []
  vars.PATH.push('/usr/bin', '/bin', '/usr/sbin', '/sbin', tea.string)

  const defaults: Env = {}
  const combined: Env = {}
  const combinedStrings: Record<string, string> = {}
  for (const key of EnvKeys) {
    const defaultValue = Deno.env.get(key)
      ?.split(":")
      ?.filter(x => !x.startsWith(usePrefix().string)) ?? [] //FIXME not great
    defaults[key] = defaultValue
    combined[key] = (vars[key] ?? []).concat(defaultValue)
    combinedStrings[key] = combined[key].join(":")
  }

  return { vars, defaults, combined, combinedStrings }
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
  for (const [key, value] of Object.entries(env)) {
    if (value.length == 0) continue
    rv += `export ${key}='${value.join(":")}'\n`
  }
  return rv
}
