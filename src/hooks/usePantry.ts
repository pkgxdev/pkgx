import { Package, PackageRequirement, Path, PlainObject, SemVer, semver } from "types"
import useGitHubAPI from "hooks/useGitHubAPI.ts"
import { run, flatMap, isNumber, isPlainObject, isString, isArray } from "utils"
import useCellar from "hooks/useCellar.ts"


interface GetDepsOptions {
  pkg: Package | PackageRequirement
  wbuild?: boolean
}

interface Response {
  getDistributable(rq: Package): Promise<{ url: string, stripComponents?: number }>
  /// returns sorted versions
  getVersions(rq: PackageRequirement | Package): Promise<SemVer[]>
  getDeps(opts: GetDepsOptions): Promise<PackageRequirement[]>
  getBuildScript(pkg: Package): Promise<string>
  update(): Promise<void>
  getProvides(rq: PackageRequirement | Package): Promise<string[]>
}

interface Entry {
  dir: Path
  yml: () => Promise<PlainObject>
  versions: Path
}

const prefix = new Path("/opt/tea.xyz/var/pantry/projects")

export default function usePantry(): Response {
  const getVersions = async (pkg: PackageRequirement) => {
    const files = entry(pkg)
    let rv: SemVer[]
    if (await txt()) return rv!
    if (await github()) return rv!.sort()
    const foo = (await files.yml()).versions
    if (isArray(foo)) {
      if (foo.length > 5) throw "use-versions.txt-if-more-than-5-versions"
      return foo.map(x => new SemVer(x))
    }
    throw "no-versions"

    async function txt(): Promise<boolean> {
      if (!files.versions.isReadableFile()) return false
      const txt = await files.versions.read()
      rv = txt.split(/\w+/).map(x => new SemVer(x)).sort()
      return true
    }

    async function github(): Promise<boolean> {
      const yml = await files.yml()
      try {
        const { user, repo } = get()
        rv = await useGitHubAPI().getVersions({ user, repo })
        return true
      } catch (err) {
        if (err === "not-github") return false
        throw err
      }

      function get() {
        if (isString(yml.versions?.github)) {
          const [user, repo] = yml.versions.github.split("/")
          return { user, repo }
        } else {
          const url = new URL(getRawDistributableURL(yml))
          if (url.host != "github.com") throw "not-github"
          const [, user, repo] = url.pathname.split("/")
          return { user, repo }
        }
      }
    }
  }

  const getDeps = async ({pkg, wbuild}: GetDepsOptions) => {
    const yml =  await entry(pkg).yml()
    return go(yml.dependencies).concat(go(wbuild && yml.build?.dependencies))
    // deno-lint-ignore no-explicit-any
    function go(node: any) {
      if (!node) return []
      const rv: PackageRequirement[] = []
      const deps = validatePlainObject(node)
      for (const [project, rawconstraint] of Object.entries(deps)) {
        if (project == "cc") continue //FIXME
        if (project == "c++") continue //FIXME
        if (project == "tea.xyz") continue //FIXME
        console.debug(project, rawconstraint)
        const constraint = new semver.Range(`${rawconstraint}`)
        rv.push({ project, constraint })
      }
      return rv
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

    url = url
      .replace(/{{\s*version\s*}}/g, pkg.version.toString())
      .replace(/{{\s*version.major\s*}}/g, pkg.version.major.toString())
      .replace(/{{\s*version.minor\s*}}/g, pkg.version.minor.toString())
      .replace(/{{\s*version.build\s*}}/g, pkg.version.build.join('+'))

    return { url, stripComponents }
  }

  const getBuildScript = async (pkg: Package) => {
    const yml = await entry(pkg).yml()
    const prefix = useCellar().mkpath(pkg)
    const raw = validateString(validatePlainObject(yml.build).script)
    return raw
      .replace(/{{\s*prefix\s*}}/g, prefix.string)
      .replace(/{{\s*version\s*}}/g, pkg.version.toString())
      .replace(/{{\s*jobs\s*}}/g, navigator.hardwareConcurrency.toString())  //TODO remove, only available with ts build scripts
  }

  const update = async () => {
    await run({
      cmd: ["git", "-C", prefix, "pull", "origin", "HEAD", "--no-edit"]
    })
  }

  const getProvides = async (pkg: Package | PackageRequirement) => {
    const yml = await entry(pkg).yml()
    const node = yml["provides"]
    if (!isArray(node)) throw "bad-yaml"
    return node.compactMap(x => isString(x) && x.startsWith("bin/") && x.slice(4))
  }

  return { getVersions, getDeps, getDistributable, getBuildScript, update, getProvides }
}


// deno-lint-ignore no-explicit-any
function validateString(input: any): string {
  if (typeof input != 'string') throw new Error(`not-string: ${input}`)
  return input
}

// deno-lint-ignore no-explicit-any
function validatePlainObject(input: any): PlainObject {
  if (!isPlainObject(input)) throw "not-plain-obj"
  return input
}

// deno-lint-ignore no-explicit-any
function coerceNumber(input: any) {
  if (isNumber(input)) return input
}

//TODO we have a better system in mind than git
async function installIfNecessary() {
  if (!prefix.exists()) {
    const cwd = prefix.parent().parent().mkpath()
    //FIXME before release, use https://
    await run({
      cmd: ["git", "clone", "git@github.com:teaxyz/pantry.git"],
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
