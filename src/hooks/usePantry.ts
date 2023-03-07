// deno-lint-ignore-file no-cond-assign
import { Package, PackageRequirement, Installation } from "types"
import { host, validate_plain_obj, pkg, TeaError } from "utils"
import { isNumber, isPlainObject, isString, isArray, isPrimitive, PlainObject, isBoolean } from "is_what"
import { validatePackageRequirement } from "utils/hacks.ts"
import { useCellar, usePrefix } from "hooks"
import { ls, pantry_paths, prefix } from "./usePantry.ls.ts"
import Path from "path"

interface Entry {
  dir: Path
  yml: () => Promise<PlainObject>
  versions: Path
}

export interface Interpreter {
  project: string // FIXME: should probably be a stronger type
  args: string[]
}

export default function usePantry() {
  return {
    getClosestPackageSuggestion,
    getDeps,
    getCompanions,
    getProvides,
    getInterpreter,
    getRuntimeEnvironment,
    ls,
    prefix
  }
}

/// returns ONE LEVEL of deps, to recurse use `hydrate.ts`
const getDeps = async (pkg: Package | PackageRequirement) => {
  const yml = await entry(pkg).yml()
  return parse_pkgs_node(yml.dependencies)
}

// deno-lint-ignore no-explicit-any
function parse_pkgs_node(node: any) {
  if (!node) return []
  node = validate_plain_obj(node)
  platform_reduce(node)

  const rv: PackageRequirement[] = []
  for (const [project, constraint] of Object.entries(node)) {
    rv.compact_push(validatePackageRequirement({ project, constraint }))
  }
  return rv
}

const getProvides = async (pkg: { project: string }) => {
  const yml = await entry(pkg).yml()
  const node = yml["provides"]
  if (!node) return []
  if (!isArray(node)) throw new Error("bad-yaml")

  return node.compact(x => {
    if (isPlainObject(x)) {
      x = x["executable"]
    }
    if (isString(x)) {
      if (x.startsWith("bin/")) return x.slice(4)
      if (x.startsWith("sbin/")) return x.slice(5)
    }
  })
}

const getCompanions = async (pkg: {project: string}) => {
  const yml = await entry(pkg).yml()
  const node = yml["companions"]
  return parse_pkgs_node(node)
}

const getInterpreter = async (extension: string): Promise<Interpreter | undefined> => {
  extension = extension.slice(1)
  if (!extension) return
  for await (const pkg of ls()) {
    const yml = await entry(pkg).yml()
    const node = yml["interprets"]
    if (!isPlainObject(node)) continue
    try {
      const { extensions, args } = yml["interprets"]
      if ((isString(extensions) && extensions === extension) ||
        (isArray(extensions) && extensions.includes(extension))) {
        return { project: pkg.project, args: isArray(args) ? args : [args] }
      }
    } catch {
      continue
    }
  }
  return undefined
}

const getRuntimeEnvironment = async (pkg: Package): Promise<Record<string, string>> => {
  const yml = await entry(pkg).yml()
  const obj = validate_plain_obj(yml["runtime"]?.["env"] ?? {})
  return expand_env_obj(obj, pkg, [])
}

function entry({ project }: { project: string }): Entry {
  for (const prefix of pantry_paths()) {
    if (!prefix.exists()) throw new TeaError('not-found: pantry', { path: prefix.parent() })
    const dir = prefix.join(project)
    const filename = dir.join("package.yml")
    if (!filename.exists()) continue
    const yml = async () => {
      try {
        const yml = await filename.readYAML()
        if (!isPlainObject(yml)) throw null
        return yml
      } catch (cause) {
        throw new TeaError('parser: pantry: package.yml', {cause, project, filename})
      }
    }
    const versions = dir.join("versions.txt")
    return { dir, yml, versions }
  }

  throw new TeaError('not-found: pantry: package.yml', {project}, )
}

async function getClosestPackageSuggestion(input: string) {
  let choice: string | undefined
  let min = Infinity
  for await (const {project} of ls()) {
    if (min == 0) break

    getProvides({ project }).then(provides => {
      if (provides.includes(input)) {
        choice = project
        min = 0
      }
    })

    const dist = levenshteinDistance(project, input)
    if (dist < min) {
      min = dist
      choice = project
    }
  }
  return choice
}

function levenshteinDistance (str1: string, str2:string):number{
  const track = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null))
  for (let i = 0; i <= str1.length; i += 1) {
     track[0][i] = i
  }
  for (let j = 0; j <= str2.length; j += 1) {
     track[j][0] = j
  }
  for (let j = 1; j <= str2.length; j += 1) {
     for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        track[j][i] = Math.min(
           track[j][i - 1] + 1, // deletion
           track[j - 1][i] + 1, // insertion
           track[j - 1][i - 1] + indicator, // substitution
        );
     }
  }
  return track[str2.length][str1.length]
}

/// expands platform specific keys into the object
/// expands inplace because JS is nuts and you have to suck it up
function platform_reduce(env: PlainObject) {
  const sys = host()
  for (const [key, value] of Object.entries(env)) {
    const [os, arch] = (() => {
      let match = key.match(/^(darwin|linux)\/(aarch64|x86-64)$/)
      if (match) return [match[1], match[2]]
      if (match = key.match(/^(darwin|linux)$/)) return [match[1]]
      if (match = key.match(/^(aarch64|x86-64)$/)) return [,match[1]]
      return []
    })()

    if (!os && !arch) continue
    delete env[key]
    if (os && os != sys.platform) continue
    if (arch && arch != sys.arch) continue

    const dict = validate_plain_obj(value)
    for (const [key, value] of Object.entries(dict)) {
      // if user specifies an array then we assume we are supplementing
      // otherwise we are replacing. If this is too magical let us know
      if (isArray(value)) {
        if (!env[key]) env[key] = []
        else if (!isArray(env[key])) env[key] = [env[key]]
        //TODO if all-platforms version comes after the specific then order accordingly
        env[key].push(...value)
      } else {
        env[key] = value
      }
    }
  }
}

function expand_env_obj(env_: PlainObject, pkg: Package, deps: Installation[]): Record<string, string> {
  const env = {...env_}

  platform_reduce(env)

  const rv: Record<string, string> = {}

  for (let [key, value] of Object.entries(env)) {
    if (isArray(value)) {
      value = value.map(transform).join(" ")
    } else {
      value = transform(value)
    }

    rv[key] = value
  }

  return rv

  // deno-lint-ignore no-explicit-any
  function transform(value: any): string {
    if (!isPrimitive(value)) throw new Error(`invalid-env-value: ${JSON.stringify(value)}`)

    if (isBoolean(value)) {
      return value ? "1" : "0"
    } else if (value === undefined || value === null) {
      return "0"
    } else if (isString(value)) {
      const mm = useMoustaches()
      return mm.apply(value, mm.tokenize.all(pkg, deps))
    } else if (isNumber(value)) {
      return value.toString()
    }
    throw new Error("unexpected-error")
  }
}

//////////////////////////////////////////// useMoustaches() additions
import useMoustachesBase from "./useMoustaches.ts"

function useMoustaches() {
  const base = useMoustachesBase()

  const deps = (deps: Installation[]) => {
    const map: {from: string, to: string}[] = []
    for (const dep of deps ?? []) {
      map.push({ from: `deps.${dep.pkg.project}.prefix`, to: dep.path.string })
      map.push(...useMoustaches().tokenize.version(dep.pkg.version, `deps.${dep.pkg.project}.version`))
    }
    return map
  }

  const tea = () => [{ from: "tea.prefix", to: usePrefix().string }]

  const all = (pkg: Package, deps_: Installation[]) => [
    ...deps(deps_),
    ...tokenizePackage(pkg),
    ...tea(),
    ...base.tokenize.version(pkg.version),
    ...base.tokenize.host(),
  ]

  return {
    apply: base.apply,
    tokenize: {
      ...base.tokenize,
      deps, pkg, tea, all
    }
  }
}

function tokenizePackage(pkg: Package) {
  return [{ from: "prefix", to: useCellar().keg(pkg).string }]
}
