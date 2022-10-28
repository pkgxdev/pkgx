//CONTRACT you can’t use anything from hooks

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
    compact<S>(body?: (t: T) => S | null | undefined | false, opts?: { rescue: boolean }): Array<S>
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
  return this.compact(x => {
    const s = x.toString()
    if (set.has(s)) return
    set.add(s)
    return x
  })
}

Array.prototype.compact = function<T, S>(body?: (t: T) => S | null | undefined | false, opts?: { rescue: boolean }) {
  const rv: Array<S> = []
  for (const e of this) {
    try {
      const f = body ? body(e) : e
      if (f) rv.push(f)
    } catch (err) {
      if (opts === undefined || opts.rescue === false) throw err
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

export function flatmap<S, T>(t: T | undefined | null, body: (t: T) => S | undefined, opts?: {rescue?: boolean}): NonNullable<S> | undefined {
  try {
    if (t) return body(t) ?? undefined
  } catch (err) {
    if (!opts?.rescue) throw err
  }
}

export function pivot<E, L, R>(input: E[], body: (e: E) => ['L', L] | ['R', R]): [L[], R[]] {
  const rv = {
    'L': [] as L[],
    'R': [] as R[]
  }
  for (const e of input) {
    const [side, value] = body(e)
    // deno-lint-ignore no-explicit-any
    rv[side].push(value as any)
  }
  return [rv['L'], rv['R']]
}

declare global {
  interface Promise<T> {
    swallow(err: unknown): Promise<T | undefined>
  }
}

Promise.prototype.swallow = function(gristle: unknown) {
  return this.catch((err: unknown) => {
    if (err instanceof Error) err = err.message
    if (isPlainObject(err) && isString(err.code)) err = err.code
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

export interface RunOptions extends Omit<Deno.RunOptions, 'cmd'|'cwd'|'stdout'|'stderr'> {
  cmd: (string | Path)[] | Path
  cwd?: (string | Path)
  clearEnv?: boolean  //NOTE might not be cross platform!
  spin?: boolean  // hide output unless an error occurs
}

export async function run({ spin, ...opts }: RunOptions) {
  const cmd = isArray(opts.cmd) ? opts.cmd.map(x => `${x}`) : [opts.cmd.string]
  const cwd = opts.cwd?.toString()
  console.verbose({ cwd, ...opts, cmd })

  const stdio = { stdout: 'inherit', stderr: 'inherit' } as Pick<Deno.RunOptions, 'stdout'|'stderr'>
  if (spin) {
    stdio.stderr = stdio.stdout = 'piped'
  }
  const proc = Deno.run({ ...opts, cmd, cwd, ...stdio })

  try {
    const exit = await proc.status()
    console.verbose({ exit })
    if (!exit.success) throw {code: exit.code}
  } catch (err) {
    if (spin) {
      //FIXME this doesn’t result in the output being correctly interlaced
      // ie. stderr and stdout may (probably) have been output interleaved rather than sequentially
      const decode = (() => { const e = new TextDecoder(); return e.decode.bind(e) })()
      console.error(decode(await proc.output()))
      console.error(decode(await proc.stderrOutput()))
    }
    throw err
  }
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
export function panic(message?: string): never {
  throw new Error(message)
}

// deno-lint-ignore no-explicit-any
export function tuplize<T extends any[]>(...elements: T) {
  return elements
}

///////////////////////////////////////////////////////////////////////// pkgs
import * as pkg from "./pkg.ts"
export { pkg }

///////////////////////////////////////////////////////////////////// platform
import { SupportedPlatform, SupportedArchitectures } from "types"
import { StreamConstructorsImpl } from "https://deno.land/x/rimbu@0.12.3/stream/custom/stream-custom.ts"

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
