import { Installation, PackageSpecification } from "types"
import { host } from "utils"
import Path from "path"

// returns an environment that supports the provided packages
//TODO possibly should add the env for pending and not delegate via tea
//TODO like ideally we would provide shims for POSIX and not include the system PATHs at all

export const EnvKeys = [
  'PATH',
  'MANPATH',
  'PKG_CONFIG_PATH',
  'LIBRARY_PATH',
  'LD_LIBRARY_PATH',
  'CPATH',
  'XDG_DATA_DIRS',
  'CMAKE_PREFIX_PATH',
  'DYLD_FALLBACK_LIBRARY_PATH',
  'SSL_CERT_FILE'
]

interface Options {
  installations: Installation[]
  pending?: PackageSpecification[],
}

export default function useShellEnv({installations, pending}: Options): Record<string, string[]> {
  const vars: Record<string, string[]> = {}
  const isMac = host().platform == 'darwin'
  pending ??= []

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

    if (installation.pkg.project === 'openssl.org') {
      vars.SSL_CERT_FILE ??= []
      vars.SSL_CERT_FILE.compact_unshift(installation.path.join("ssl/cert.pem").compact()?.string)
    }
  }

   // needed since on Linux library paths aren’t automatically included when linking
   // so otherwise linked binfiles will not run
   if (vars.LIBRARY_PATH) {
    vars.LD_LIBRARY_PATH = vars.LIBRARY_PATH
    if (isMac) {
      vars.DYLD_FALLBACK_LIBRARY_PATH = vars.LIBRARY_PATH
    }
  }

  //FIXME refactor lol
  const rv: Record<string, string[]> = {}
  for (const key of EnvKeys) {
    //FIXME where is this `undefined` __happening__?
    if (!vars[key]?.chuzzle()) continue

    rv[key] = vars[key]

    if (key == 'PATH' && installations.length) {
      //NOTE this is intentional to avoid general hell type end-user debugging scenarios
      //SOZZ if this breaks your workflow :(
        rv[key] = rv[key].filter(x => x !== '/usr/local/bin')

      /// sooooo, we need to make sure tea is still in the PATH
      const tea = find_tea()
      if (tea?.string == '/usr/local/bin/tea') {
        // lol, k expand it if possible and stick it on the end
        rv[key].push(tea.readlink().parent().string)
      }
    }
  }

  return rv
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
    case 'DYLD_FALLBACK_LIBRARY_PATH':
    case 'CPATH':
    case 'CMAKE_PREFIX_PATH':
    case 'SSL_CERT_FILE':
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

function find_tea() {
  for (const bindir of Deno.env.get("PATH")?.split(":") ?? []) {
    const file = new Path(bindir).join("tea").isExecutableFile()
    if (file) return file
  }
}
