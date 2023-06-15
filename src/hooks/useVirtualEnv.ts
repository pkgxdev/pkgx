import usePackageYAMLFrontMatter, { refineFrontMatter, FrontMatter } from "./useYAMLFrontMatter.ts"
import { PackageRequirement, Path, SemVer, utils, TeaError, hooks, semver } from "tea"
import * as JSONC from "deno/jsonc/mod.ts"
const { flatmap, pkg, validate } = utils
import { isPlainObject } from "is-what"
import useConfig from "./useConfig.ts"
const { useMoustaches } = hooks

export interface VirtualEnv {
  pkgs: PackageRequirement[]
  teafiles: Path[]
  srcroot: Path
  version?: SemVer
  env: Record<string, string>
}

// we call into useVirtualEnv a bunch of times
const cache: Record<string, VirtualEnv> = {}

export default async function(cwd: Path): Promise<VirtualEnv> {
  const { TEA_DIR } = useConfig().env
  cwd = TEA_DIR ?? cwd

  if (cache[cwd.string]) return cache[cwd.string]

  let dir = cwd ?? Path.cwd()
  const home = Path.home()
  const pkgs: PackageRequirement[] = []
  const env: Record<string, string> = {}
  const constraint = new semver.Range('*')
  const teafiles: Path[] = []

  let version: SemVer | undefined
  let srcroot: Path | undefined
  let f: Path | undefined

  if (cwd.eq(home)) {
    // if the CWD is HOME then allow it to be a dev env but don't continue searching
    try {
      await supp(dir)
    } catch (err) {
      err.cause = f
      throw err
    }
  } else {
    while (dir.neq(home) && dir.neq(Path.root)) {
      try {
        await supp(dir)
      } catch (err) {
        err.cause = f
        throw err
      }
      if (TEA_DIR && dir.eq(TEA_DIR)) break
      dir = dir.parent()
    }
  }

  const lastd = teafiles.slice(-1)[0]?.parent()
  if (TEA_DIR) {
    srcroot = TEA_DIR
  } else if (!srcroot || lastd?.components().length < srcroot.components().length) {
    srcroot = lastd
  }

  if (!srcroot) throw new TeaError("not-found: dev-env", {cwd, TEA_DIR})

  for (const [key, value] of Object.entries(env)) {
    if (key != 'TEA_PREFIX') {
      env[key] = fix(value)
    } else {
      delete env['TEA_PREFIX']  // screws everything up… so… no
    }
  }

  function fix(input: string): string {
    if (!input) return ''  // https://github.com/teaxyz/cli/issues/424
    const moustaches = useMoustaches()
    const foo = [
      ...moustaches.tokenize.host(),
      { from: "tea.prefix", to: useConfig().prefix.string },
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
      // deno-lint-ignore no-explicit-any
      const tea = (json as any)?.tea
      if (isPlainObject(tea)) {
        insert(refineFrontMatter(tea, srcroot))
      }
    }
    if (_if(".node-version")) {
      // https://github.com/shadowspawn/node-version-usage
      let s = (await f!.read()).trim()
      if (s.startsWith('v')) s = s.slice(1)  // v prefix has no effect but is allowed
      s = `nodejs.org@${s}`
      try {
        pkgs.push(pkg.parse(s))
      } catch {
        throw new Error('couldn’t parse: .node-version')
      }
    }
    if (_if(".ruby-version")) {
      let s = (await f!.read()).trim()
      // TODO: How to handle non-bare versions like mruby-3.2.0, jruby-9.4.2.0, etc. from `rbenv install -L`
      s = `ruby-lang.org@${s}`
      try {
        pkgs.push(pkg.parse(s))
      } catch {
        throw new Error('couldn’t parse: .ruby-version')
      }
    }
    if (_if(".python-version")) {
      const s = (await f!.read()).trim()
      const lines = s.split("\n")
      for (let l of lines) {
        l = l.trim()
        if (!l) continue  // skip empty lines
        if (l.startsWith('#')) continue  // skip commented lines
        // TODO: How to handle 'system'?
        // TODO: How to handle non-bare versions like pypy3.9-7.3.11, stackless-3.7.5, etc. in pyenv install --list?
        l = `python.org@${l}`
        try {
          pkgs.push(pkg.parse(l))
          break // only one thanks
        } catch {
          //noop pyenv sticks random shit in here
        }
      }
    }
    if (_if("package.json")) {
      const json = JSON.parse(await f!.read())
      if (isPlainObject(json?.tea)) {
        insert(refineFrontMatter(json?.tea, srcroot))
      }

      //TODO should be moved to after all pkgs are inspected probs
      const projects = new Set(pkgs.map(x => x.project))
      if (!projects.has("bun.sh")) {
        pkgs.push({project: "nodejs.org", constraint})
      }

      flatmap(semver.parse(json?.version), v => version = v)
    }
    if (_if("action.yml", "action.yaml")) {
      const yaml = validate.obj(await f!.readYAML())
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
    if (_if(".yarnrc")) {
      pkgs.push({ project: "classic.yarnpkg.com", constraint })
    }
    if (_if(".yarnrc.yml")) {
      pkgs.push({ project: "yarnpkg.com", constraint })
    }
    if (_if("tea.yml", "tea.yaml")) {
      insert(refineFrontMatter(await f!.readYAML()))
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
