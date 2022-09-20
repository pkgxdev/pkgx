import { isString, isPlainObject, isArray, isRegExp, PlainObject } from "is_what"

// deno-lint-ignore no-explicit-any
export function validate_str(input: any): string {
  if (typeof input == 'boolean') return input ? 'true' : 'false'
  if (typeof input == 'number') return input.toString()
  if (typeof input != 'string') throw new Error(`not-string: ${input}`)
  return input
}

// deno-lint-ignore no-explicit-any
export function validate_plain_obj(input: any): PlainObject {
  if (!isPlainObject(input)) throw new Error(`not-plain-obj: ${JSON.stringify(input)}`)
  return input
}

// deno-lint-ignore no-explicit-any
export function validate_arr<T>(input: any): Array<T> {
  if (!isArray(input)) throw new Error(`not-array: ${JSON.stringify(input)}`)
  return input
}


///////////////////////////////////////////////////////////////////////// HTTP
export async function GET<T>(url: URL | string, headers?: Headers): Promise<T> {
  if (isString(url)) url = new URL(url)
  if (url.host == "api.github.com") {
    const token = Deno.env.get("GITHUB_TOKEN")
    if (token) {
      headers ??= new Headers()
      headers.append("Authorization", `bearer ${token}`)
    }
  }
  const rsp = await fetch(url, { headers })
  const json = await rsp.json()
  return json as T
}


////////////////////////////////////////////////////////////// base extensions
import outdent from "outdent"
export { outdent as undent }

declare global {
  interface Array<T> {
    compact_map<S>(body: (t: T) => S | null | undefined | false, opts?: { throws: boolean }): Array<S>
    compact_push(item: T | undefined | null): void
    compact_unshift(item: T | undefined | null): void
    chuzzle(): Array<T> | undefined
    uniq(): Array<T>
  }

  interface String {
    chuzzle(): string | undefined
  }

  interface Console {
    // deno-lint-ignore no-explicit-any
    verbose(...args: any[]): void

    /// prohibits standard logging unless verbosity is loud or above
    silence<T>(body: () => Promise<T>): Promise<T>
  }
}

String.prototype.chuzzle = function() {
  return this.trim() || undefined
}

export function chuzzle(input: number) {
  return Number.isNaN(input) ? undefined : input
}

Array.prototype.uniq = function<T>(): Array<T> {
  const set = new Set<T>()
  return this.compact_map(x => {
    const s = x.toString()
    if (set.has(s)) return
    set.add(s)
    return x
  })
}

Array.prototype.compact_map = function<T, S>(body: (t: T) => S | null | undefined | false, opts: { throws: boolean }) {
  const rv: Array<S> = []
  for (const e of this) {
    if (!opts?.throws) {
      const f = body(e)
      if (f) rv.push(f)
    } else {
      try {
        const f = body(e)
        if (f) rv.push(f)
      } catch {/*noop*/}
    }
  }
  return rv
}

//TODO would be nice to chuzzle contents to reduce first
Array.prototype.chuzzle = function<T>() {
  if (this.length <= 0) {
    return undefined
  } else {
    return this
  }
}

console.verbose = console.log

console.silence = async function<T>(body: () => Promise<T>) {
  const originals = [console.log, console.info]
  try {
    console.log = () => {}
    console.info = () => {}
    return await body()
  } finally {
    console.log = originals[0]
    console.info = originals[1]
  }
}

Array.prototype.compact_push = function<T>(item: T | null | undefined) {
  if (item) this.push(item)
}

Array.prototype.compact_unshift = function<T>(item: T | null | undefined) {
  if (item) this.unshift(item)
}

export function flatmap<S, T>(t: T | undefined | null, body: (t: T) => S | undefined): NonNullable<S> | undefined {
  if (t) return body(t) ?? undefined
}

declare global {
  interface Promise<T> {
    swallow(err: unknown): Promise<T | undefined>
  }
}

Promise.prototype.swallow = function(gristle: unknown) {
  return this.catch((err: unknown) => {
    if (err instanceof Error) err = err.message
    if (isRegExp(gristle) && isString(err)) {
      if (!err.match(gristle)) throw err
    } else if (err !== gristle) {
      throw err
    }
    return undefined
  })
}

export async function attempt<T>(body: () => Promise<T>, opts: {swallow: unknown}): Promise<T | undefined> {
  try {
    return await body()
  } catch (err) {
    if (err !== opts.swallow) throw err
  }
}

/////////////////////////////////////////////////////////////////// Unarchiver
import { Unarchiver, TarballUnarchiver, ZipUnarchiver } from "./Unarchiver.ts"
export { Unarchiver, TarballUnarchiver, ZipUnarchiver }


////////////////////////////////////////////////////////////////////////// run
import Path from "path"

interface RunOptions extends Omit<Deno.RunOptions, 'cmd'|'cwd'> {
  cmd: (string | Path)[] | Path
  cwd?: (string | Path)
  clearEnv?: boolean  //NOTE might not be cross platform!
}

export async function run(opts: RunOptions) {
  const cmd = isArray(opts.cmd) ? opts.cmd.map(x => `${x}`) : [opts.cmd.string]
  const cwd = opts.cwd?.toString()
  console.verbose({ cwd, ...opts, cmd })
  const proc = Deno.run({ ...opts, cmd, cwd })
  const exit = await proc.status()
  console.verbose({ exit })
  if (!exit.success) throw new Error("run-error")
}

export async function backticks(opts: RunOptions): Promise<string> {
  const cmd = isArray(opts.cmd) ? opts.cmd.map(x => `${x}`) : [opts.cmd.string]
  const cwd = opts.cwd?.toString()
  console.verbose({ cwd, ...opts, cmd })
  const proc = Deno.run({ ...opts, cwd, cmd, stdout: "piped" })
  const out = await proc.output()
  const txt = new TextDecoder().decode(out)
  return txt
}

/////////////////////////////////////////////////////////////////////////// io
// for output that the user requested, everything from console.* might be silenced
const encoder = new TextEncoder()
export const print = (x: string) => Deno.stdout.write(encoder.encode(`${x}\n`))


///////////////////////////////////////////////////////////////////////// misc
export function panic<T>(): T {
  throw new Error()
}

///////////////////////////////////////////////////////////////////////// pkgs
import { Package, PackageRequirement } from "types"

export function parse_pkg_requirement(input: string): PackageRequirement {
  const match = input.match(/^(.*?)([\^=~<>@].+)?$/)
  if (!match) throw new Error()

  if (match[2] && match[2].startsWith("@")) {
    match[2] = match[2].slice(1)
  }

  return {
    project: match[1],
    constraint: new semver.Range(match[2] ?? "*")
  }
}

export function parse_pkg(input: string): Package {
  const splat = input.split(/[@=]/)
  if (splat.length == 2) {
    return {
      project: splat[0],
      version: new SemVer(splat[1])
    }
  } else {
    throw new Error("invalid-pkgspec")
  }
}

export function compare_pkg(a: Package, b: Package): number {
  return a.project === b.project
    ? a.version.compare(b.version)
    : (a.project < b.project ? -1 : 1)
}

/////////////////////////////////////////////////////////////////////// semver
import SemVer, * as semver from "semver"

export function semver_intersection(a: semver.Range, b: semver.Range): semver.Range {
  if (a.intersects(b)) return a
  if (b.intersects(a)) return b
  console.error(a, b)
  throw new Error()
}

///////////////////////////////////////////////////////////////////// platform
// when we support more variants of these that require specification
// we will tuple a version in with each eg. 'darwin' | ['windows', 10 | 11 | '*']
export const SupportedPlatforms = ["darwin", "linux", "windows"] as const
export type SupportedPlatform = typeof SupportedPlatforms[number]

export type SupportedArchitectures = 'x86-64' | 'aarch64'

interface HostReturnValue {
  platform: SupportedPlatform
  arch: SupportedArchitectures
  target: string
  build_ids: [SupportedPlatform, SupportedArchitectures]
}

export function host(): HostReturnValue {
  const arch = (() => {
    switch (Deno.build.arch) {
      case "aarch64": return "aarch64"
      case "x86_64": return "x86-64"
      // ^^ ∵ https://en.wikipedia.org/wiki/X86-64 and semver.org prohibits underscores
    }
  })()

  const { os: platform, target } = Deno.build

  return {
    platform,
    arch,
    target,
    build_ids: [platform, arch]
  }
}
