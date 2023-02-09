import { usePackageYAMLFrontMatter, refineFrontMatter, FrontMatter } from "./usePackageYAML.ts"
import { flatmap, TeaError, validate_plain_obj } from "utils"
import { useMoustaches, usePrefix } from "hooks"
import { PackageRequirement } from "types"
import SemVer, * as semver from "semver"
import { JSONC } from "jsonc"
import Path from "path"

export interface VirtualEnv {
  pkgs: PackageRequirement[]
  teafiles: Path[]
  srcroot: Path
  version?: SemVer
  env: Record<string, string>
}

// we call into useVirtualEnv a bunch of times
const cache: Record<string, VirtualEnv> = {}

export default async function(cwd: Path = Path.cwd()): Promise<VirtualEnv> {

  if (cache[cwd.string]) return cache[cwd.string]

  let dir = cwd ?? Path.cwd()
  const home = Path.home()
  const pkgs: PackageRequirement[] = []
  const env: Record<string, string> = {}
  const constraint = new semver.Range('*')
  const teafiles: Path[] = []
  const TEA_DIR = Deno.env.get("TEA_DIR")
  let version: SemVer | undefined
  let srcroot: Path | undefined
  let f: Path | undefined

  while (dir.neq(Path.root) && dir.neq(home)) {
    try {
      await supp(dir)
    } catch (err) {
      err.cause = f
      throw err
    }
    dir = dir.parent()
  }

  const lastd = teafiles.slice(-1)[0]?.parent()
  if (TEA_DIR) {
    srcroot = Path.cwd().join(TEA_DIR)
  } else if (!srcroot || lastd?.components().length < srcroot.components().length) {
    srcroot = lastd
  }

  if (!srcroot) throw new TeaError("not-found: dev-env", {cwd, TEA_DIR})

  for (const [key, value] of Object.entries(env)) {
    env[key] = fix(value)
  }

  function fix(input: string): string {
    const moustaches = useMoustaches()
    const foo = [
      ...moustaches.tokenize.host(),
      { from: "tea.prefix", to: usePrefix().string },
      { from: "home", to: Path.home().string },
      { from: "srcroot", to: srcroot!.string}
    ]
    return moustaches.apply(input, foo)
  }


  const rv = { pkgs, srcroot, teafiles, version, env }
  cache[cwd.string] = rv
  return rv

  function insert(fm: FrontMatter | undefined) {
    if (!fm) return
    pkgs.push(...fm.pkgs)
    for (const [key, value] of Object.entries(fm.env)) {
      if (env[key]) {
        env[key] = `${value}:${env[key]}` // prepend
      } else {
        env[key] = value
      }
    }
  }

  async function supp(dir: Path) {
    if (!dir.isDirectory()) throw new Error()

    const _if = (...names: string[]) => {
      for (const name of names) {
        if ((f = dir.join(name).isFile())) {
          teafiles.push(f)
          console.debug(f)
          return f
        }}}
    const _if_d = (...names: string[]) => {
      for (const name of names) {
        if ((f = dir.join(name).isDirectory())) {
          return f
        }}}
    const _if_md = (name: string) =>
      markdown_extensions.find(ext =>
        f = dir.join(`${name}.${ext}`).isFile())


    if (_if("deno.json", "deno.jsonc")) {
      pkgs.push({project: "deno.land", constraint})
      const json = JSONC.parse(await f!.read())
      insert(refineFrontMatter(json?.tea, srcroot))
    }
    if (_if(".node-version")) {
      const constraint = semver.Range.parse((await f!.read()).trim())
      if (!constraint) throw new Error('couldn’t parse: .node-version')
      pkgs.push({ project: "nodejs.org", constraint })
    }
    if (_if("package.json")) {
      const json = JSON.parse(await f!.read())
      insert(refineFrontMatter(json?.tea, srcroot))

      //TODO should be moved to after all pkgs are inspected probs
      const projects = new Set(pkgs.map(x => x.project))
      if (!projects.has("bun.sh")) {
        pkgs.push({project: "nodejs.org", constraint})
      }

      flatmap(semver.parse(json?.version), v => version = v)
    }
    if (_if("action.yml")) {
      const yaml = validate_plain_obj(await f!.readYAML())
      const [,v] = yaml.runs?.using.match(/node(\d+)/) ?? []
      pkgs.push({
        project: "nodejs.org",
        constraint: new semver.Range(`^${v}`)
      })
    }
    if (_if("cargo.toml")) {
      pkgs.push({project: "rust-lang.org", constraint})
      insert(await usePackageYAMLFrontMatter(f!))
      //TODO read the TOML too
    }
    if (_if("go.mod", "go.sum")) {
      pkgs.push({project: "go.dev", constraint})
      insert(await usePackageYAMLFrontMatter(f!))
    }
    if (_if("requirements.txt", "pipfile", "pipfile.lock", "setup.py")) {
      pkgs.push({project: "python.org", constraint})
      insert(await usePackageYAMLFrontMatter(f!))
    }
    if (_if("pyproject.toml")) {
      pkgs.push({project: "python-poetry.org", constraint})
      insert(await usePackageYAMLFrontMatter(f!))
    }
    if (_if("Gemfile")) {
      pkgs.push({project: "ruby-lang.org", constraint})
      insert(await usePackageYAMLFrontMatter(f!))
    }
    if (_if_md("README")) {
      const rv = await README(f!)
      pkgs.push(...rv.pkgs)
      if (rv.version) version = rv.version
      if (rv.version || rv.pkgs.length) {
        teafiles.push(f!)
      } else {
        // we still consider this a potential SRCROOT indicator
        srcroot = f!.parent()
      }
    }
    if (_if("package.yaml")) {
      //TODO check if package.yaml has been taken or not
      //TODO should be pacakge.yml like in pantry or what?
    }
    if (_if("VERSION")) {
      flatmap(semver.parse(await f!.read()), v => version = v)
    }
    if (_if_d(".git") && Deno.build.os != "darwin") {
      // pkgs.push({project: "git-scm.org", constraint})
      srcroot ??= f
    }
    if (_if_d(".hg", ".svn")) {
      srcroot ??= f
    }
  }
}

const markdown_extensions = [
  "md",
  'mkd',
  'mdwn',
  'mdown',
  'mdtxt',
  'mdtext',
  'markdown',
  'text',
  'md.txt'
]

export async function README(path: Path): Promise<{version?: SemVer, pkgs: PackageRequirement[]}> {
  const text = await path.read()
  const lines = text.split("\n")

  const findTable = (header: string) => {
    let prevline = ''
    let rows: [string, string][] | undefined = undefined
    let found: 'nope' | 'header' | 'table' = 'nope'
    done: for (const line of lines) {
      switch (found) {
      case 'header': {
        if (!line.trim()) continue
        if (line.match(/^\|\s*-+\s*\|\s*-+\s*\|(\s*-+\s*\|)?\s*$/)) found = 'table'
      } break
      case 'table': {
        const match = line.match(/^\|([^|]+)\|([^|]+)\|/)
        if (!match) break done
        if (!rows) rows = []
        rows.push([match[1].trim(), match[2].trim()])
      } break
      case 'nope':
        if (line.match(new RegExp(`^#+\\s*${header}\\s*$`))) {
          //HACK so tea/clit itself doesn’t pick up the example table lol
          //FIXME use a real parser!
          if (prevline != '$ cat <<EOF >>my-project/README.md') {
            found = 'header'
          }
        }
      }
      prevline = line
    }
    return rows
  }

  const pkgs = (() => {
    return findTable("Dependencies")?.compact(([project, constraint]) => {
      if (project.startsWith("tea.xyz")) return //FIXME
      return {
        project,
        constraint: new semver.Range(constraint)
      }
    })
  })() ?? []

  const fromMetadataTable = () => flatmap(
    findTable("Metadata")?.find(([key, value]) => key.toLowerCase() == "version" && value),
    ([,x]) => new SemVer(x)
  )

  const fromFirstHeader = () => {
    for (let line of lines) {
      line = line.trim()
      if (/^#+/.test(line)) {
        const match = line.match(new RegExp(`v?(${semver.regex.source})$`))
        if (match) {
          return new SemVer(match[1])
        } else {
          return  // we only check the first header
        }
      }
    }
  }

  const version = fromMetadataTable() ?? fromFirstHeader()

  return {version, pkgs}
}
