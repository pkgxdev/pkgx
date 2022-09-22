// deno-lint-ignore-file no-cond-assign

/**
 * we have our own implementation because open source is full of weird
 * but *almost* valid semver schemes, eg:
   * openssl 1.1.1q
   * ghc 5.64.3.2
 * it also allows us to implement semver_intersection without hating our lives
 */
export default class SemVer {
  major: number
  minor: number
  patch: number

  //FIXME
  prerelease: string[] = []
  build: string[] = []

  raw: string

  constructor(input: string | [number,number,number] | number) {
    if (typeof input == 'string') {
      const match = input.match(/(\d+)\.(\d+)\.(\d+)/)
      if (!match) throw new Error(`invalid semver: ${input}`)
      this.major = parseInt(match[1])!
      this.minor = parseInt(match[2])!
      this.patch = parseInt(match[3])!
      this.raw = input
    } else if (typeof input == 'number') {
      this.major = input
      this.minor = 0
      this.patch = 0
      this.raw = input.toString()
    } else {
      this.major = input[0]
      this.minor = input[1]
      this.patch = input[2]
      this.raw = `${this.major}.${this.minor}.${this.patch}`
    }
  }

  toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`
  }

  eq(other: SemVer): boolean {
    return this.compare(other) == 0
  }

  neq(other: SemVer): boolean {
    return !this.eq(other)
  }

  compare(other: SemVer): number {
    return _compare(this, other)
  }

  components(): [number, number, number] {
    return [this.major, this.minor, this.patch]
  }

  [Symbol.for("Deno.customInspect")]() {
    return this.toString()
  }
}

/// more tolerant parser
export function parse(input: string) {
  const v = new SemVer([0,0,0])
  v.raw = input

  let match: RegExpMatchArray | number | null | undefined

  if (match = input.match(/^v?(\d+)\.(\d+)\.(\d+)?$/)) {
    v.major = parseInt(match[1])!
    v.minor = parseInt(match[2])!
    v.patch = parseInt(match[3] ?? '0')!
  } else if (match = input.match(/^v?(\d+)\.(\d+)$/)) {
    v.major = parseInt(match[1])!
    v.minor = parseInt(match[2])!
  } else if (match = input.match(/^v?(\d+)$/)) {
    v.major = parseInt(match[1])!
  } else {
    return undefined
  }

  return v
}

/// we don’t support as much as node-semver but we refuse to do so because it is badness
export class Range {
  // contract [0, 1] where 0 != 1 and 0 < 1
  set: [SemVer, SemVer][] | '*'

  constructor(input: string) {
    if (input === "*") {
      this.set = '*'
    } else {
      input = input.trim()

      this.set = input.split(/(?:,|\s*\|\|\s*)/).map(input => {
        if (input.startsWith("^")) {
          const v1 = parse(input.slice(1))!
          const v2 = new SemVer([v1.major + 1,0,0])
          return [v1, v2]
        }

        let match = input.match(/^\d+(\.\d+(\.\d+)?)?$/)
        if (match) {
          const v1 = parse(match[0])!
          const v2 = new SemVer(v1.components())
          if (!match[1]) {
            v2.major++
          } else if (!match[2]) {
            v2.minor++
          } else {
            v2.patch++
          }
          return [v1, v2]
        }

        match = input.match(/^>=((\d+\.)*\d+)\s*(<((\d+\.)*\d+))?$/)
        if (!match) throw new Error(`invalid semver range: ${input}`)
        const v1 = parse(match[1])!
        const v2 = match[3] ? parse(match[4])! : new SemVer([Infinity, Infinity, Infinity])
        return [v1, v2]
      })

      if (this.set.length == 0) throw new Error(`invalid semver range: ${input}`)
    }
  }

  toString(): string {
    if (this.set === '*') {
      return '*'
    } else {
      return this.set.map(([v1, v2]) => {
        if (v2.minor == 0 && v2.patch == 0) {
          const v = chomp(v1)
          return `^${v}`
        } else if (v2.major == Infinity) {
          const v = chomp(v1)
          return `>=${v}`
        } else {
          const v = this.single()
          if (v) {
            return `@${v}`
          } else {
            return `>=${v1}<${v2}`
          }
        }
      }).join(",")
    }
  }

  satisfies(version: SemVer): boolean {
    if (this.set === '*') {
      return true
    } else {
      return this.set.some(([v1, v2]) => version.compare(v1) >= 0 && version.compare(v2) < 0)
    }
  }

  max(versions: SemVer[]): SemVer | undefined {
    return versions.filter(x => this.satisfies(x)).sort((a,b) => a.compare(b)).pop()
  }

  single(): SemVer | undefined {
    if (this.set === '*') return
    if (this.set.length > 1) return
    const [a,b] = this.set[0]
    if (a.major != b.major) return
    if (a.minor != b.minor) return
    if (a.patch == b.patch - 1) return a
  }

  [Symbol.for("Deno.customInspect")]() {
    return this.toString()
  }
}

function _compare(a: SemVer, b: SemVer): number {
  if (a.major != b.major) return a.major - b.major
  if (a.minor != b.minor) return a.minor - b.minor
  return a.patch - b.patch
}
export { _compare as compare }

//FIXME yes yes this is not sufficient
export const regex = /\d+\.\d+\.\d+/

function chomp(v: SemVer) {
  return v.toString().replace(/(\.0)+$/g, '') || '0'
}