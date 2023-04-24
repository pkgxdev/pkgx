import { Package, PackageRequirement, Installation } from "types"
import { host, validate_plain_obj, pkg, TeaError, validate_arr } from "utils"
import { isNumber, isPlainObject, isString, isArray, isPrimitive, PlainObject, isBoolean } from "is_what"
import { validatePackageRequirement } from "utils/hacks.ts"
import { useCellar, usePrefix } from "hooks"
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
    getDeps,
    getCompanions,
    getProvides,
    getProvider,
    getInterpreter,
    getRuntimeEnvironment,
    available,
    ls,
    prefix: getPantryPrefix()
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
  let node = yml["provides"]
  if (!node) return []
  if (isPlainObject(node)) {
    node = node[host().platform]
  }
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

import { parse as parseYaml } from "deno/encoding/yaml.ts"

const getProvider = async ({ project }: { project: string }) => {
  for (const prefix of pantry_paths()) {
    if (!prefix.exists()) continue
    const dir = prefix.join(project)
    const filename = dir.join("provider.yml")
    if (!filename.exists()) continue
    const read = await Deno.readTextFile(filename.string)
    const yaml = validate_plain_obj(await parseYaml(read))
    const cmds = validate_arr<string>(yaml.cmds)
    return (binname: string) => {
      if (!cmds.includes(binname)) return
      const args = yaml['args']
      if (isPlainObject(args)) {
        if (args[binname]) {
          return get_args(args[binname])
        } else {
          return get_args(args['...'])
        }
      } else {
        return get_args(args)
      }
    }
  }

  function get_args(input: unknown) {
    if (isString(input)) {
      return input.split(/\s+/)
    } else {
      return validate_arr<string>(input)
    }
  }
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

const available = async (pkg: PackageRequirement): Promise<boolean> => {
  let { platforms } = await entry(pkg).yml()
  if (!platforms) return true
  if (isString(platforms)) platforms = [platforms]
  if (!isArray(platforms)) throw new Error("bad-yaml")
  return platforms.includes(host().platform) ||platforms.includes(`${host().platform}/${host().arch}`)
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

/// expands platform specific keys into the object
/// expands inplace because JS is nuts and you have to suck it up
function platform_reduce(env: PlainObject) {
  const sys = host()
  for (const [key, value] of Object.entries(env)) {
    const [os, arch] = (() => {
      let match = key.match(/^(darwin|linux)\/(aarch64|x86-64)$/)
      if (match) return [match[1], match[2]]
      if ((match = key.match(/^(darwin|linux)$/))) return [match[1]]
      if ((match = key.match(/^(aarch64|x86-64)$/))) return [,match[1]]
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
      const home = Path.home().string
      const obj = [
        { from: 'env.HOME', to: home },  // historic, should be removed at v1
        { from: 'home', to: home }       // remove, stick with just ~
      ]
      obj.push(...mm.tokenize.all(pkg, deps))
      return mm.apply(value, obj)
    } else if (isNumber(value)) {
      return value.toString()
    }
    throw new Error("unexpected-error")
  }
}

//////////////////////////////////////////// useMoustaches() additions
import useMoustachesBase from "./useMoustaches.ts"
import { useEnv } from "./useConfig.ts"

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

const getPantryPrefix = () => usePrefix().join('tea.xyz/var/pantry/projects')

export function pantry_paths(): Path[] {
  const rv: Path[] = []
  const { TEA_PANTRY_PATH } = useEnv()

  const prefix = getPantryPrefix()
  if (prefix.isDirectory()) rv.push(prefix)

  if (TEA_PANTRY_PATH) for (const path of TEA_PANTRY_PATH.split(":").reverse()) {
    rv.unshift(Path.cwd().join(path, "projects"))
  }

  if (rv.length == 0) throw new TeaError("not-found: pantry", {prefix})

  return rv
}

interface LsEntry {
  project: string
  path: Path
}

export async function* ls(): AsyncGenerator<LsEntry> {
  for (const prefix of pantry_paths()) {
    for await (const path of _ls_pantry(prefix)) {
      yield {
        project: path.parent().relative({ to: prefix }),
        path
      }
    }
  }
}

async function* _ls_pantry(dir: Path): AsyncGenerator<Path> {
  if (!dir.isDirectory()) throw new TeaError('not-found: pantry', { path: dir })

  for await (const [path, { name, isDirectory }] of dir.ls()) {
    if (isDirectory) {
      for await (const x of _ls_pantry(path)) {
        yield x
      }
    } else if (name === "package.yml" || name === "package.yaml") {
      yield path
    }
  }
}
