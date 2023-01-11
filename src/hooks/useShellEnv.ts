import { Installation } from "types"
import { OrderedHashSet } from "rimbu/ordered/set/index.ts"
import { flatmap, host, pkg as pkgutils } from "utils"
import { usePrefix, usePantry } from "hooks"
import { isArray } from "is_what"

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
  'TEA_PREFIX',
  'PYTHONPATH',
  'npm_config_prefix',
  'ACLOCAL_PATH'
] as const
export type EnvKey = typeof EnvKeys[number]

interface Options {
  installations: Installation[]
}

/// returns an environment that supports the provided packages
export default async function useShellEnv({installations}: Options): Promise<Record<string, string[]>> {
  const {getRuntimeEnvironment} = usePantry()

  const vars: Partial<Record<EnvKey, OrderedHashSet<string>>> = {}
  const isMac = host().platform == 'darwin'

  const projects = new Set(installations.map(x => x.pkg.project))
  const has_cmake = projects.has('cmake.org')
  const archaic = true

  const rv: Record<string, string[]> = {}
  const seen = new Set<string>()

  for (const installation of installations) {

    if (!seen.insert(installation.pkg.project).inserted) {
      console.warn("warning: env is being duped:", installation.pkg.project)
    }

    for (const key of EnvKeys) {
      for (const suffix of suffixes(key)!) {
        vars[key] = compact_add(vars[key], installation.path.join(suffix).compact()?.string)
      }
    }

    if (archaic) {
      vars.LIBRARY_PATH = compact_add(vars.LIBRARY_PATH, installation.path.join("lib").compact()?.string)
      vars.CPATH = compact_add(vars.CPATH, installation.path.join("include").compact()?.string)
    }

    if (has_cmake) {
      vars.CMAKE_PREFIX_PATH = compact_add(vars.CMAKE_PREFIX_PATH, installation.path.string)
    }

    if (projects.has('gnu.org/autoconf')) {
      vars.ACLOCAL_PATH = compact_add(vars.ACLOCAL_PATH, installation.path.join("share/aclocal").compact()?.string)
    }

    if (installation.pkg.project === 'openssl.org') {
      const certPath = installation.path.join("ssl/cert.pem").compact()?.string
      // this is a single file, so we assume a
      // valid entry is correct
      if (certPath) vars.SSL_CERT_FILE = OrderedHashSet.of(certPath)
    }

    // pip requires knowing where its root is
    // otherwise it bases it off the location
    // of python, which won't work for us
    if (installation.pkg.project === 'pip.pypa.io') {
      vars.PYTHONPATH = compact_add(vars.PYTHONPATH, installation.path.string)
    }

    // npm requires knowing where its root is
    // otherwise it bases it off the location
    // of node, which won't work for us
    if (installation.pkg.project === 'npmjs.com') {
      vars.npm_config_prefix = OrderedHashSet.of(installation.path.string)
    }

    // pantry configured runtime environment
    const runtime = await getRuntimeEnvironment(installation.pkg)
    for (const key in runtime) {
      rv[key] ??= []
      rv[key].push(runtime[key])
    }
  }

   // this is how we use precise versions of libraries
   // for your virtual environment
   //FIXME SIP on macOS prevents DYLD_FALLBACK_LIBRARY_PATH from propagating to grandchild processes
   if (vars.LIBRARY_PATH) {
    vars.LD_LIBRARY_PATH = vars.LIBRARY_PATH
    if (isMac) {
      // non FALLBACK variety causes strange issues in edge cases
      // where our symbols somehow override symbols from the macOS system
      vars.DYLD_FALLBACK_LIBRARY_PATH = vars.LIBRARY_PATH
    }
  }

  const rewind = flatmap(Deno.env.get("TEA_REWIND"), x => JSON.parse(x)?.["PATH"])

  for (const key of EnvKeys) {
    //FIXME where is this `undefined` __happening__?
    if (vars[key] === undefined || vars[key]!.isEmpty) continue
    rv[key] = vars[key]!.toArray()

    if (key == 'PATH') {
      if (isArray(rewind)) {
        rv[key] ??= []
        rv[key].push(...rewind)
      } else {
        // first time we've stepped into a devenv
        rv[key].push(...(Deno.env.get("PATH")?.split(":") ?? []))
      }
    }
  }

  if (isMac) {
    // required to link to our libs
    // tea.xyz/gx/cc automatically adds this, but use of any other compilers will not
    rv["LDFLAGS"] = [`-Wl,-rpath,${usePrefix()}`]
  }

  rv["TEA_PREFIX"] = [usePrefix().string]

  // don’t break `man` lol
  rv["MANPATH"]?.push("/usr/share/man")

  rv["TEA_PKGS"] = installations.map(x => pkgutils.str(x.pkg))

  return rv
}

function suffixes(key: EnvKey) {
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
    case 'PYTHONPATH':
    case 'npm_config_prefix':
    case 'ACLOCAL_PATH':
      return []  // we handle these specially
    default: {
      const exhaustiveness_check: never = key
      throw new Error(`unhandled id: ${exhaustiveness_check}`)
  }}
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

function compact_add<T>(set: OrderedHashSet<T> | undefined, item: T | null | undefined): OrderedHashSet<T> {
  if (!set) set = OrderedHashSet.empty<T>()
  if (item) set = set.add(item)

  return set
}
