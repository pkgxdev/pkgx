import { Package, PackageRequirement, Installation } from "types"
import { run, host, flatmap, undent, validate_plain_obj, validate_str, validate_arr, panic, pkg } from "utils"
import { useCellar, useGitHubAPI, usePrefix } from "hooks"
import { validatePackageRequirement } from "utils/hacks.ts"
import { isNumber, isPlainObject, isString, isArray, isPrimitive, PlainObject, isBoolean } from "is_what"
import SemVer, * as semver from "semver"
import Path from "path"

interface Entry {
  dir: Path
  yml: () => Promise<PlainObject>
  versions: Path
}

const prefix = usePrefix().join('tea.xyz/var/pantry/projects')

export default function usePantry() {
  return {
    getVersions,
    getDeps,
    getDistributable,
    getScript,
    update,
    getProvides,
    getYAML,
    prefix: getPrefix,
    resolve
  }
}

async function resolve(spec: Package | PackageRequirement): Promise<Package> {
  if ("version" in spec) {
    return spec
  } else {
    const versions = await getVersions(spec)
    const version = spec.constraint.max(versions)
    if (!version) throw new Error(`no-version-found: ${pkg.str(spec)}`)
    return { project: spec.project, version };
  }
}

//TODO take `T` and then type check it
const getYAML = async (pkg: Package | PackageRequirement): Promise<[PlainObject, Path]> => {
  const foo = entry(pkg)
  const yml = await foo.yml()
  return [yml, foo.dir.join("package.yml")]
}

/// returns ONE LEVEL of deps, to recurse use `hydrate.ts`
const getDeps = async (pkg: Package | PackageRequirement) => {
  const yml =  await entry(pkg).yml()
  return {
    runtime: go(yml.dependencies),
    build: go(yml.build?.dependencies),
    test: go(yml.test?.dependencies)
  }
  // deno-lint-ignore no-explicit-any
  function go(node: any) {
    if (!node) return []
    return Object.entries(validate_plain_obj(node))
      .compact(([project, constraint]) => validatePackageRequirement({ project, constraint }))
  }
}

const getRawDistributableURL = (yml: PlainObject) => validate_str(
    isPlainObject(yml.distributable)
      ? yml.distributable.url
      : yml.distributable)

const getDistributable = async (pkg: Package) => {
  const yml = await entry(pkg).yml()
  let urlstr = getRawDistributableURL(yml)
  let stripComponents: number | undefined
  if (isPlainObject(yml.distributable)) {
    urlstr = validate_str(yml.distributable.url)
    stripComponents = flatmap(yml.distributable["strip-components"], coerceNumber)
  } else {
    urlstr = validate_str(yml.distributable)
  }

  urlstr = remapTokens(urlstr, pkg)

  const url = new URL(urlstr)

  return { url, stripComponents }
}

const getScript = async (pkg: Package, key: 'build' | 'test', deps: Installation[]) => {
  const yml = await entry(pkg).yml()
  const node = yml[key]

  if (isPlainObject(node)) {
    let raw = remapTokens(validate_str(node.script), pkg, deps)

    let wd = node["working-directory"]
    if (wd) {
      wd = remapTokens(wd, pkg)
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
    return remapTokens(validate_str(node), pkg, deps)
  }
}

const update = async () => {
  //FIXME real fix is: don’t use git!
  const git = usePrefix().join('git-scm.org/v*')
  if (git.isDirectory() || Path.root.join("usr/bin/git").isExecutableFile()) {
    await run({
      cmd: ["git", "-C", prefix, "pull", "origin", "HEAD", "--no-edit"]
    })
  }
}

const getProvides = async (pkg: Package | PackageRequirement) => {
  const yml = await entry(pkg).yml()
  const node = yml["provides"]
  if (!isArray(node)) throw "bad-yaml"

  return node.compact(x => {
    if (isPlainObject(x)) {
      x = x["executable"]
    }
    if (isString(x)) {
      return x.startsWith("bin/") && x.slice(4)
    }
  })
}


// deno-lint-ignore no-explicit-any
function coerceNumber(input: any) {
  if (isNumber(input)) return input
}

//TODO we have a better system in mind than git
async function installIfNecessary() {
  if (!prefix.exists()) {
    const cwd = prefix.parent().parent().mkpath()
    await run({
      cmd: ["git", "clone", "https://github.com/teaxyz/pantry"],
      cwd
    })
  }
}

function entry(pkg: Package | PackageRequirement): Entry {
  const dir = prefix.join(pkg.project)
  const yml = async () => {
    await installIfNecessary()
    // deno-lint-ignore no-explicit-any
    const yml = await dir.join("package.yml").readYAML() as any
    if (!isPlainObject(yml)) throw "bad-yaml"
    return yml
  }
  const versions = dir.join("versions.txt")
  return { dir, yml, versions }
}

/// returns sorted versions
async function getVersions(pkg: PackageRequirement): Promise<SemVer[]> {
  const files = entry(pkg)
  const versions = await files.yml().then(x => x.versions)

  if (isArray(versions)) {
    return versions.map(raw =>
      semver.parse(validate_str(raw)) ?? panic()
    )
  } else if (isPlainObject(versions)) {
    return handleComplexVersions(versions)
  } else {
    throw new Error()
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
  for (let name of rsp) {

    name = strip(name)

    if (ignore.some(x => x.test(name))) {
      console.debug({ignoring: name, reason: 'explicit'})
    } else {
      const v = semver.parse(name)
      if (!v) {
        console.warn({ignoring: name, reason: 'unparsable'})
      } else if (v.prerelease.length <= 0) {
        console.verbose({ found: v.toString(), from: name })
        rv.push(v)
      } else {
        console.debug({ignoring: name, reason: 'prerelease'})
      }
    }
  }
  return rv
}

function expand_env(env_: PlainObject, pkg: Package, deps: Installation[]): string {
  const env = {...env_}
  const sys = host()

  for (const [key, value] of Object.entries(env)) {
    const match = key.match(/^(darwin|linux)(\/(x86-64|aarch64))?$/)
    if (!match) continue
    delete env[key]
    const [, os, , arch] = match
    if (os != sys.platform) continue
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
      return remapTokens(value, pkg, deps)
    } else if (isNumber(value)) {
      return value.toString()
    }
    throw new Error("unexpected-error")
  }
}

const remapTokens = (input: string, pkg: Package, deps?: Installation[]) => {
  const sys = host()
  const cellar = useCellar()
  const prefix = cellar.keg(pkg)

  const map = [
    { from: "version",           to: pkg.version.toString() },
    { from: "version.major",     to: pkg.version.major.toString() },
    { from: "version.minor",     to: pkg.version.minor.toString() },
    { from: "version.patch",     to: pkg.version.patch.toString() },
    { from: "version.build",     to: pkg.version.build.join('+') },
    { from: "version.marketing", to: `${pkg.version.major}.${pkg.version.minor}` },
    { from: "version.raw",       to: pkg.version.raw },
    { from: "hw.arch",           to: sys.arch },
    { from: "hw.target",         to: sys.target },
    { from: "hw.platform",       to: sys.platform },
    { from: "prefix",            to: prefix.string },
    { from: "hw.concurrency",    to: navigator.hardwareConcurrency.toString() },
    { from: "pkg.pantry-prefix", to: getPrefix(pkg).string },
    { from: "tea.prefix",        to: usePrefix().string }
  ]

  for (const dep of deps ?? []) {
    map.push({ from: `deps.${dep.pkg.project}.prefix`, to: dep.path.string })
    map.push({ from: `deps.${dep.pkg.project}.version`, to: dep.pkg.version.toString() })
    map.push({ from: `deps.${dep.pkg.project}.version.major`, to: dep.pkg.version.major.toString() })
  }

  return map.reduce((acc, {from, to}) =>
    acc.replace(new RegExp(`\\$?{{\\s*${from}\\s*}}`, "g"), to),
    input)
}

const getPrefix = (pkg: Package | PackageRequirement) => prefix.join(pkg.project)
