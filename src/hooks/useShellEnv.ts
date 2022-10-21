import { Installation, PackageSpecification } from "types"
import { host } from "utils"
import { usePrefix } from "hooks"
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
  'SSL_CERT_FILE',
  'LDFLAGS',
  'TEA_PREFIX'
]

interface Options {
  installations: Installation[]
  pending?: PackageSpecification[],
  pristine?: boolean
}

export default function useShellEnv({installations, pending, pristine}: Options): Record<string, string[]> {
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
      // this is a single file, so we assume the first
      // valid entry is correct
      vars.SSL_CERT_FILE = vars.SSL_CERT_FILE.slice(0, 1)
    }
  }

   // this is how we use precise versions of libraries
   // for your virtual environment
   //FIXME SIP on macOS prevents DYLD_FALLBACK_LIBRARY_PATH from propogating to grandchild processes
   if (vars.LIBRARY_PATH) {
    vars.LD_LIBRARY_PATH = vars.LIBRARY_PATH
    if (isMac) {
      // non FALLBACK variety causes strange issues in edge cases
      // where our symbols somehow override symbols from the macOS system
      vars.DYLD_FALLBACK_LIBRARY_PATH = vars.LIBRARY_PATH
    }
  }

  //FIXME refactor lol
  const rv: Record<string, string[]> = {}
  for (const key of EnvKeys) {
    //FIXME where is this `undefined` __happening__?
    if (!vars[key]?.chuzzle()) continue
    rv[key] = vars[key]

    if (!pristine && key == 'PATH') {
      rv[key] ??= []

      if (!projects.has('tea.xyz')) {
        const tea = find_tea()
        if (tea) {
          const tea = find_tea()?.parent().string
          if (tea && !rv["PATH"].includes(tea)) {
            rv["PATH"].push(tea)
          }
        }
      }

      // for std POSIX tools FIXME: we provide shims or pkgs for (at least some of) these
      //NOTE we deliberately do not include /usr/local/bin
      //NOTE though we add that back for `tea --dump` since users will want their tools ofc
      for (const path of ["/usr/bin", "/bin", "/usr/sbin", "/sbin"]) {
        if (!rv["PATH"].includes(path)) {
          rv["PATH"].push(path)
        }
      }
    }
  }

  if (isMac) {
    // required to link to our libs
    // tea.xyz/gx/cc automatically adds this, but use of any other compilers will not
    rv["LDFLAGS"] = [`-Wl,-rpath,${usePrefix()}`]
  }

  rv["TEA_PREFIX"] = [usePrefix().string]

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
    case 'LDFLAGS':
    case 'TEA_PREFIX':
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

export function flatten(env: Record<string, string[]>) {
  const rv: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    rv[key] = value.join(":")
  }
  return rv
}

function find_tea() {
  for (const bindir of Deno.env.get("PATH")?.split(":") ?? []) {
    const file = new Path(bindir).join("tea").isExecutableFile()
    if (file) return file
  }
}
