import { isString, isPlainObject, isDate, isEmptyArray, isEmptyObject, isArray, isNumber, isPositiveNumber, isRegExp } from "is_what"
export { isString, isPlainObject, isDate, isEmptyArray, isEmptyObject, isArray, isNumber, isPositiveNumber, isRegExp }

///////////////////////////////////////////////////////////////////////// HTTP
import { cache, File, Policy, configure } from "https://deno.land/x/cache@0.2.13/mod.ts"

//FIXME lol better
configure({ directory: "/opt/tea.xyz/var/www2" })

export function download(
  url: string | URL,
  policy?: Policy,
  ns?: string,
): Promise<File> {
  console.verbose({downloading: url})
  return cache(url, policy, ns)
}

export async function GET<T>(url: string): Promise<T> {
  const foo = await download(url)
  const txt = await Deno.readTextFile(foo.path)
  const json = JSON.parse(txt)
  return json as T
}


////////////////////////////////////////////////////////////// base extensions
import outdent from "https://deno.land/x/outdent@v0.8.0/mod.ts"
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

export function flatMap<S, T>(t: T | undefined | null, body: (t: T) => S | undefined): S | undefined {
  if (t) return body(t)
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


/////////////////////////////////////////////////////////////////// Unarchiver
import { Unarchiver, TarballUnarchiver, ZipUnarchiver } from "./utils/Unarchiver.ts"
export { Unarchiver, TarballUnarchiver, ZipUnarchiver }


////////////////////////////////////////////////////////////////////////// run
import { Path } from "types"

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
  if (!exit.success) throw "run-error"
}


/////////////////////////////////////////////////////////////////////////// io
// for output that the user requested, everything from console.* might be silenced
const encoder = new TextEncoder()
export const print = (x: string) => Deno.stdout.write(encoder.encode(`${x}\n`))
