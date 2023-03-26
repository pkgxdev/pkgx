// utils safe enough “pure” stuff (eg. semver.ts, Path.ts)

export function chuzzle(input: number) {
  return Number.isNaN(input) ? undefined : input
}

export function panic(message?: string): never {
  throw new Error(message)
}
