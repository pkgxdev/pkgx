// deno-lint-ignore-file no-cond-assign
import { semver, Package, PackageRequirement, Path, PlainObject, SemVer } from "types"
import useGitHubAPI from "hooks/useGitHubAPI.ts"
import { run, flatMap, isNumber, isPlainObject, isString, isArray, isPrimitive, undent, isBoolean, validatePlainObject, validateString, validateArray, panic } from "utils"
import useCellar from "hooks/useCellar.ts"
import usePlatform from "hooks/usePlatform.ts"
import { validatePackageRequirement } from "utils/lvl2.ts"

type SemVerExtended = SemVer & {pkgraw: string}

interface Entry {
  dir: Path
  yml: () => Promise<PlainObject>
  versions: Path
}

const prefix = new Path(`${useCellar().prefix}/tea.xyz/var/pantry/projects`)

export default function usePantry() {
  return {
    getVersions,
    getDeps,
    getDistributable,
    getScript,
    update,
    getProvides,
    getYAML,
    prefix: getPrefix
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
    return Object.entries(validatePlainObject(node))
      .compactMap(([project, constraint]) => validatePackageRequirement({ project, constraint }))
  }
}

const getRawDistributableURL = (yml: PlainObject) => validateString(
    isPlainObject(yml.distributable)
      ? yml.distributable.url
      : yml.distributable)

const getDistributable = async (pkg: Package) => {
  const yml = await entry(pkg).yml()
  let url = getRawDistributableURL(yml)
  let stripComponents: number | undefined
  if (isPlainObject(yml.distributable)) {
    url = validateString(yml.distributable.url)
    stripComponents = flatMap(yml.distributable["strip-components"], coerceNumber)
  } else {
    url = validateString(yml.distributable)
  }

  url = remapTokens(url, pkg)

  return { url, stripComponents }
}

const getScript = async (pkg: Package, key: 'build' | 'test') => {
  const yml = await entry(pkg).yml()
  const node = yml[key]

  if (isPlainObject(node)) {
    let raw = remapTokens(validateString(node.script), pkg)

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
      raw = `${expand_env(env, pkg)}\n\n${raw}`
    }
    return raw
  } else {
    return remapTokens(validateString(node), pkg)
  }
}

const update = async () => {
  //FIXME real fix is: don’t use git!
  const git = useCellar().prefix.join('git-scm.org/v*')
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

  return node.compactMap(x => {
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
async function getVersions(pkg: PackageRequirement): Promise<SemVerExtended[]> {
  const files = entry(pkg)
  const versions = await files.yml().then(x => x.versions)

  if (isArray(versions)) {
    return versions.map(raw => {
      const v = parser(validateString(raw)) ?? panic()
      const vv = v as SemVerExtended
      vv.pkgraw = validateString(raw)
      return vv
    })
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

async function handleComplexVersions(versions: PlainObject): Promise<SemVerExtended[]> {
  const [user, repo, ...types] = validateString(versions.github).split("/")
  const type = types?.join("/").chuzzle() ?? 'releases'

  const ignore = (() => {
    const arr = (() => {
      if (!versions.ignore) return []
      if (isString(versions.ignore)) return [versions.ignore]
      return validateArray(versions.ignore)
    })()
    return arr.map(input => {
      let rx = validateString(input)
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

  const rv: SemVerExtended[] = []
  for (let name of rsp) {

    name = strip(name)

    if (ignore.some(x => x.test(name))) {
      console.debug({ignoring: name, reason: 'explicit'})
    } else {
      const v = await parser(name)
      if (!v) {
        console.warn({ignoring: name, reason: 'unparsable'})
      } else if (v.prerelease.length <= 0) {
        const vv = v as SemVerExtended
        console.verbose({ found: v.toString(), from: name })
        if (name[0] == 'v') name = name.slice(1) // semver.parse strips this, so we do too
        vv.pkgraw = name
        rv.push(vv)
      } else {
        console.debug({ignoring: name, reason: 'prerelease'})
      }
    }
  }
  return rv
}

const parser = (input: string) => {
  let v: SemVer | null
  if (v = semver.parse(input)) return v
  input = input.trim()
  let rv: RegExpExecArray | null
  if (rv = /^v?(\d+\.\d+)$/.exec(input)) return semver.parse(`${rv[1]}.0`)
  if (rv = /^v?(\d+)$/.exec(input)) return semver.parse(`${rv[1]}.0.0`)
}

function expand_env(env_: PlainObject, pkg: Package): string {
  const env = {...env_}
  const sys = usePlatform()

  for (const [key, value] of Object.entries(env)) {
    const match = key.match(/^(darwin|linux)(\/(x86-64|aarch64))?$/)
    console.log(match)
    if (!match) continue
    delete env[key]
    const [, os, , arch] = match
    if (os != sys.platform) continue
    if (arch && arch != sys.arch) continue

    const dict = validatePlainObject(value)
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
      return remapTokens(value, pkg)
    } else if (isNumber(value)) {
      return value.toString()
    }
    throw new Error("unexpected-error")
  }
}

const remapTokens = (input: string, pkg: Package) => {
  const platform = usePlatform()
  const cellar = useCellar()
  const prefix = cellar.mkpath(pkg)

  return [
    { from: "version",           to: pkg.version.toString() },
    { from: "version.major",     to: pkg.version.major.toString() },
    { from: "version.minor",     to: pkg.version.minor.toString() },
    { from: "version.patch",     to: pkg.version.patch.toString() },
    { from: "version.build",     to: pkg.version.build.join('+') },
    { from: "version.marketing", to: `${pkg.version.major}.${pkg.version.minor}` },
    { from: "version.raw",       to: (pkg.version as any).pkgraw },
    { from: "hw.arch",           to: platform.arch },
    { from: "hw.target",         to: platform.target },
    { from: "hw.platform",       to: platform.platform },
    { from: "prefix",            to: prefix.string },
    { from: "hw.concurrency",    to: navigator.hardwareConcurrency.toString() },
    { from: "pkg.pantry-prefix", to: getPrefix(pkg).string },
    { from: "tea.prefix",        to: cellar.prefix.string }
  ].reduce((acc, {from, to}) =>
    acc.replace(new RegExp(`\\$?{{\\s*${from}\\s*}}`, "g"), to),
    input)
}

const getPrefix = (pkg: Package | PackageRequirement) => prefix.join(pkg.project)
