// utils safe enough “pure” stuff (eg. semver.ts, Path.ts)

export function chuzzle(input: number) {
  return Number.isNaN(input) ? undefined : input
}

export function panic(message?: string): never {
  throw new Error(message)
}

export function flatmap<S, T>(t: T | undefined | null, body: (t: T) => S | undefined, opts?: {rescue?: boolean}): NonNullable<S> | undefined {
  try {
    if (t) return body(t) ?? undefined
  } catch (err) {
    if (!opts?.rescue) throw err
  }
}
