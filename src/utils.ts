import { isString, isPlainObject, isDate, isEmptyArray, isEmptyObject, isArray, isNumber, isPositiveNumber, isRegExp, isPrimitive, isBoolean, PlainObject } from "is_what"
export { isString, isPlainObject, isDate, isEmptyArray, isEmptyObject, isArray, isNumber, isPositiveNumber, isRegExp, isPrimitive, isBoolean }



// deno-lint-ignore no-explicit-any
export function validateString(input: any): string {
  if (typeof input == 'boolean') return input ? 'true' : 'false'
  if (typeof input == 'number') return input.toString()
  if (typeof input != 'string') throw new Error(`not-string: ${input}`)
  return input
}

// deno-lint-ignore no-explicit-any
export function validatePlainObject(input: any): PlainObject {
  if (!isPlainObject(input)) throw new Error(`not-plain-obj: ${JSON.stringify(input)}`)
  return input
}

// deno-lint-ignore no-explicit-any
export function validateArray<T>(input: any): Array<T> {
  if (!isArray(input)) throw new Error(`not-array: ${JSON.stringify(input)}`)
  return input
}

///////////////////////////////////////////////////////////////////////// HTTP
import { cache, File, Policy, configure } from "mxcl/deno-cache"

//FIXME lol better
configure({ directory: "/opt/tea.xyz/var/www" })

export function download(
  url: string | URL,
  policy?: Policy,
  ns?: string,
): Promise<File> {
  console.verbose({downloading: url})
  return cache(url, policy, ns)
}

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
    compactMap<S>(body: (t: T) => S | null | undefined | false, opts?: { throws: boolean }): Array<S>
    compactPush(item: T | undefined | null): void
    compactUnshift(item: T | undefined | null): void
    chuzzle(): Array<T> | undefined
  }

  interface String {
    chuzzle(): string | undefined
  }

  interface Console {
    // deno-lint-ignore no-explicit-any
    verbose(...args: any[]): void
  }
}

String.prototype.chuzzle = function() {
  return this.trim() || undefined
}

export function chuzzle(input: number) {
  return Number.isNaN(input) ? undefined : input
}

Array.prototype.compactMap = function<T, S>(body: (t: T) => S | null | undefined | false, opts: { throws: boolean }) {
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

Array.prototype.compactPush = function<T>(item: T | null | undefined) {
  if (item) this.push(item)
}

Array.prototype.compactUnshift = function<T>(item: T | null | undefined) {
  if (item) this.unshift(item)
}

export function flatMap<S, T>(t: T | undefined | null, body: (t: T) => S | undefined): NonNullable<S> | undefined {
  if (t) return body(t) ?? undefined
}

declare global {
  interface Promise<T> {
    swallow(err: unknown): Promise<T | undefined>
  }
}

Promise.prototype.swallow = function(grizzle: unknown) {
  return this.catch((err: unknown) => {
    if (err instanceof Error) err = err.message
    if (isRegExp(grizzle) && isString(err)) {
      if (!err.match(grizzle)) throw err
    } else if (err !== grizzle) {
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

export function packageSort(a: Package, b: Package): number {
  return a.project === b.project
    ? a.version.compare(b.version)
    : (a.project < b.project ? -1 : 1)
}

/////////////////////////////////////////////////////////////////// Unarchiver
import { Unarchiver, TarballUnarchiver, ZipUnarchiver } from "./utils/Unarchiver.ts"
export { Unarchiver, TarballUnarchiver, ZipUnarchiver }


////////////////////////////////////////////////////////////////////////// run
import { Package, Path } from "types"

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

export async function runAndGetOutput(opts: RunOptions): Promise<string> {
  const cmd = isArray(opts.cmd) ? opts.cmd.map(x => `${x}`) : [opts.cmd.string]
  const cwd = opts.cwd?.toString()
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
