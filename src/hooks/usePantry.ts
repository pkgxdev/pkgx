// deno-lint-ignore-file no-cond-assign
import { Package, PackageRequirement, Installation } from "types"
import { host, flatmap, undent, validate_plain_obj, validate_str, validate_arr, panic, pkg, TeaError } from "utils"
import { isNumber, isPlainObject, isString, isArray, isPrimitive, PlainObject, isBoolean } from "is_what"
import { validatePackageRequirement } from "utils/hacks.ts"
import { useCellar, useGitHubAPI, usePrefix } from "hooks"
import { ls, pantry_paths, prefix } from "./usePantry.ls.ts"
import SemVer, * as semver from "semver"
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
    getVersions,
    getDeps,
    getDistributable,
    getCompanions,
    getScript,
    getProvides,
    getYAML,
    getInterpreter,
    getRuntimeEnvironment,
    resolve,
    ls,
    prefix
  }
}

async function resolve(spec: Package | PackageRequirement): Promise<Package> {
  const constraint = "constraint" in spec ? spec.constraint : new semver.Range(spec.version.toString())
  const versions = await getVersions(spec)
  const version = constraint.max(versions)
  if (!version) throw new Error(`no-version-found: ${pkg.str(spec)}`)
  return { project: spec.project, version };
}

//TODO take `T` and then type check it
const getYAML = (pkg: Package | PackageRequirement): { path: Path, parse: () => PlainObject} => {
  const foo = entry(pkg)
  return {
    path: foo.dir.join("package.yml"),
    parse: foo.yml
  }
}

/// returns ONE LEVEL of deps, to recurse use `hydrate.ts`
const getDeps = async (pkg: Package | PackageRequirement) => {
  const yml = await entry(pkg).yml()
  return {
    runtime: parse_pkgs_node(yml.dependencies),
    build: parse_pkgs_node(yml.build?.dependencies),
    test: parse_pkgs_node(yml.test?.dependencies)
  }
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

const getRawDistributableURL = (yml: PlainObject) => {
  if (isPlainObject(yml.distributable)) {
    return validate_str(yml.distributable.url)
  } else if (isString(yml.distributable)) {
    return yml.distributable
  } else if (yml.distributable === null || yml.distributable === undefined) {
    return
  } else {
    throw new Error(`invalid distributable node: ${yml.distributable}`)
  }
}
const getDistributable = async (pkg: Package) => {
  const moustaches = useMoustaches()

  const yml = await entry(pkg).yml()
  let urlstr = getRawDistributableURL(yml)
  if (!urlstr) return
  let stripComponents: number | undefined
  if (isPlainObject(yml.distributable)) {
    stripComponents = flatmap(yml.distributable["strip-components"], coerceNumber)
  }

  urlstr = moustaches.apply(urlstr, [
    ...moustaches.tokenize.version(pkg.version),
    ...moustaches.tokenize.host()
  ])

  const url = new URL(urlstr)

  return { url, stripComponents }
}

const getScript = async (pkg: Package, key: 'build' | 'test', deps: Installation[]) => {
  const yml = await entry(pkg).yml()
  const node = yml[key]

  const mm = useMoustaches()
  const script = (input: string) => mm.apply(validate_str(input), mm.tokenize.all(pkg, deps))

  if (isPlainObject(node)) {
    let raw = script(node.script)

    let wd = node["working-directory"]
    if (wd) {
      wd = mm.apply(wd, [
        ...mm.tokenize.version(pkg.version),
        ...mm.tokenize.host(),
        ...tokenizePackage(pkg)
      ])
      raw = undent`
        mkdir -p ${wd}
        cd ${wd}

        ${raw}
        `
    }

    const env = node.env
    if (isPlainObject(env)) {
      raw = `${expand_env(env, pkg, deps)}\n\n${raw}`
    }
    return raw
  } else {
    return script(node)
  }
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
      return x.startsWith("bin/") && x.slice(4)
    }
  })
}

const getCompanions = async (pkg: {project: string}) => {
  const yml = await entry(pkg).yml()
  const node = yml["companions"]
  return parse_pkgs_node(node)
}

const getInterpreter = async (_extension: string): Promise<Interpreter | undefined> => {
  const extension = _extension.slice(1)
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

const getRuntimeEnvironment = async (pkg: {project: string}): Promise<Record<string, string>> => {
  const yml = await entry(pkg).yml()
  return yml["runtime"]?.["env"] ?? {}
}

// deno-lint-ignore no-explicit-any
function coerceNumber(input: any) {
  if (isNumber(input)) return input
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
      } catch (underr) {
        throw new TeaError('parser: pantry: package.yml', {underr, project})
      }
    }
    const versions = dir.join("versions.txt")
    return { dir, yml, versions }
  }

  throw new TeaError('not-found: pantry: package.yml', {project}, )
}

async function getClosestPackageSuggestion(orgPkg: string): Promise<string> {
  let closestPkg = ''
  let minDistance = Infinity
  const pkgList = []
  for await (const {project} of ls()) {
    pkgList.push(project)
  }
  for (const pkgName of pkgList) {
    if(pkgName.includes(orgPkg)) return pkgName;
    const number = levenshteinDistance(pkgName, orgPkg)
    if (number<minDistance) {
      minDistance = number
      closestPkg = pkgName
    }
  }
  return closestPkg
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

/// returns sorted versions
async function getVersions(spec: Package | PackageRequirement): Promise<SemVer[]> {
  const files = entry(spec)
  const versions = await files.yml().then(x => x.versions)

  if (isArray(versions)) {
    return versions.map(raw =>
      semver.parse(validate_str(raw)) ?? panic(`couldn’t parse \`${raw}' into a semantic version`)
    )
  } else if (isPlainObject(versions)) {
    return handleComplexVersions(versions)
  } else {
    throw new Error(`couldn’t parse versions: ${pkg.str(spec)}`)
  }
}

//SRC https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}

async function handleComplexVersions(versions: PlainObject): Promise<SemVer[]> {
  const [user, repo, ...types] = validate_str(versions.github).split("/")
  const type = types?.join("/").chuzzle() ?? 'releases'

  const ignore = (() => {
    const arr = (() => {
      if (!versions.ignore) return []
      if (isString(versions.ignore)) return [versions.ignore]
      return validate_arr(versions.ignore)
    })()
    return arr.map(input => {
      let rx = validate_str(input)
      if (!(rx.startsWith("/") && rx.endsWith("/"))) {
        rx = escapeRegExp(rx)
        rx = rx.replace(/(x|y|z)\b/g, '\\d+')
        rx = `^${rx}$`
      } else {
        rx = rx.slice(1, -1)
      }
      return new RegExp(rx)
    })
  })()

  const strip: (x: string) => string = (() => {
    let rxs = versions.strip
    if (!rxs) return x => x
    if (!isArray(rxs)) rxs = [rxs]
    // deno-lint-ignore no-explicit-any
    rxs = rxs.map((rx: any) => {
      if (!isString(rx)) throw new Error()
      if (!(rx.startsWith("/") && rx.endsWith("/"))) throw new Error()
      return new RegExp(rx.slice(1, -1))
    })
    return x => {
      for (const rx of rxs) {
        x = x.replace(rx, "")
      }
      return x
    }
  })()

  switch (type) {
  case 'releases':
  case 'releases/tags':
  case 'tags':
    break
  default:
    throw new Error()
  }

  const rsp = await useGitHubAPI().getVersions({ user, repo, type })

  const rv: SemVer[] = []
  for (const pre_strip_name of rsp) {
    const name = strip(pre_strip_name)

    if (ignore.some(x => x.test(name))) {
      console.debug({ignoring: pre_strip_name, reason: 'explicit'})
    } else {
      const v = semver.parse(name)
      if (!v) {
        console.warn({ignoring: pre_strip_name, reason: 'unparsable'})
      } else if (v.prerelease.length <= 0) {
        console.verbose({ found: v.toString(), from: name });
        // used by some packages
        (v as unknown as {tag: string}).tag = pre_strip_name
        rv.push(v)
      } else {
        console.debug({ignoring: pre_strip_name, reason: 'prerelease'})
      }
    }
  }
  return rv
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


function expand_env(env_: PlainObject, pkg: Package, deps: Installation[]): string {
  const env = {...env_}

  platform_reduce(env)

  return Object.entries(env).map(([key,value]) => {
    if (isArray(value)) {
      value = value.map(transform).join(" ")
    } else {
      value = transform(value)
    }
    // weird POSIX string escaping/concat stuff
    // eg. export FOO="bar ""$baz"" bun"
    value = `"${value.trim().replace(/"/g, '""')}"`
    while (value.startsWith('""')) value = value.slice(1)  //FIXME lol better pls
    while (value.endsWith('""')) value = value.slice(0,-1) //FIXME lol better pls

    return `export ${key}=${value}`
  }).join("\n")

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