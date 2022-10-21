import { Package, PackageRequirement, Installation, SupportedPlatforms, SupportedPlatform } from "types"
import { run, host, flatmap, undent, validate_plain_obj, validate_str, validate_arr, panic, pkg } from "utils"
import { useCellar, useGitHubAPI, usePrefix, useDownload } from "hooks"
import { validatePackageRequirement } from "utils/hacks.ts"
import { isNumber, isPlainObject, isString, isArray, isPrimitive, PlainObject, isBoolean } from "is_what"
import SemVer, * as semver from "semver"
import tea_install from "prefab/install.ts"
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
    resolve
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
const getYAML = (pkg: Package | PackageRequirement): { path: Path, parse: () => Promise<PlainObject>} => {
  const foo = entry(pkg)
  return {
    path: foo.dir.join("package.yml"),
    parse: foo.yml
  }
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
    node = validate_plain_obj(node)

    const rv: PackageRequirement[] = []
    const stack = Object.entries(node)
    // deno-lint-ignore no-explicit-any
    let pkg: [string, any] | undefined
    // deno-lint-ignore no-cond-assign
    while (pkg = stack.shift()) {
      const [project, constraint] = pkg
      if (SupportedPlatforms.includes(project as SupportedPlatform)) {
        if (host().platform !== project) continue
        if (constraint === null) continue
        stack.unshift(...Object.entries(validate_plain_obj(constraint)))
      } else {
        rv.compact_push(validatePackageRequirement({ project, constraint }))
      }
    }
    return rv
  }
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

const getProvides = async (pkg: Package | PackageRequirement) => {
  const yml = await entry(pkg).yml()
  const node = yml["provides"]
  if (!node) return []
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

const find_git = async () => {
  const in_cellar = await useCellar().has({
    project: 'git-scm.org',
    constraint: new semver.Range('*')
  })
  if (in_cellar) {
    return in_cellar.path.join('bin/git')
  }

  for (const path_ of Deno.env.get('PATH')?.split(':') ?? []) {
    const path = Path.root.join(path_, 'git')
    if (path.isExecutableFile()) {
      return path
    }
  }

  try {
    const project = 'git-scm.org'
    const version = await useInventory().select({ project, constraint: new semver.Range('*') }) ?? panic()
    const install = await tea_install({ project, version })
    return install.path.join('bin/git')
  } catch (err) {
    console.warn(err)
  }
}

//TODO we have a better system in mind than git
async function install(): Promise<true | 'not-git' | 'noop'> {
  if (prefix.exists()) return 'noop'

  const git = await find_git()
  const cwd = prefix.parent().mkpath()

  if (git) {
    const { rid } = Deno.openSync(cwd.string)
    await Deno.flock(rid, true)
    try {
      if (prefix.exists()) return 'noop' // another instance of tea did it
      await run({
        cmd: [git, "clone", "https://github.com/teaxyz/pantry", "."],
        cwd
      })
    } finally {
      //TODO if this gets stuck then nothing will work so need a handler for that
      await Deno.funlock(rid)
    }
    return true
  } else {
    //FIXME if we do this, we need to be able to convert it to a git installation later
    //TODO use our tar if necessary
    const src = new URL('https://github.com/teaxyz/pantry/archive/refs/heads/main.tar.gz')
    const zip = await useDownload().download({ src })
    await run({cmd: ["tar", "xzf", zip, "--strip-components=1"], cwd})
    return 'not-git'
  }
}

const update = async () => {
  if (await install() !== 'noop') return
  const git = await find_git()
  const cwd = prefix.parent()
  if (git) {
    await run({cmd: [git, "pull", "origin", "HEAD", "--no-edit"], cwd})
  }
}

function entry(pkg: Package | PackageRequirement): Entry {
  const dir = prefix.join(pkg.project)
  const yml = async () => {
    await install()
    // deno-lint-ignore no-explicit-any
    const yml = await dir.join("package.yml").readYAML() as any
    if (!isPlainObject(yml)) throw "bad-yaml"
    return yml
  }
  const versions = dir.join("versions.txt")
  return { dir, yml, versions }
}

/// returns sorted versions
async function getVersions(spec: Package | PackageRequirement): Promise<SemVer[]> {
  const files = entry(spec)
  const versions = await files.yml().then(x => x.versions)

  if (isArray(versions)) {
    return versions.map(raw =>
      semver.parse(validate_str(raw)) ?? panic()
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
import useInventory from "./useInventory.ts"

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