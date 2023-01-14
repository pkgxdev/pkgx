import { isArray, isString } from "is_what"

/**
 * we have our own implementation because open source is full of weird
 * but *almost* valid semver schemes, eg:
   * openssl 1.1.1q
   * ghc 5.64.3.2
 * it also allows us to implement semver_intersection without hating our lives
 */
export default class SemVer {
  readonly components: number[]

  major: number
  minor: number
  patch: number

  //FIXME parse these
  readonly prerelease: string[] = []
  readonly build: string[] = []

  readonly raw: string
  readonly pretty?: string

  constructor(input: string | number[] | Range | SemVer, tolerant = false) {
    if (typeof input == 'string') {
      const vprefix = input.startsWith('v')
      const raw = vprefix ? input.slice(1) : input
      const parts = raw.split('.')
      if (parts.length == 1 && !vprefix) throw new Error(`too short to parse without a \`v\` prefix: ${input}`)
      if (parts.length == 2 && !vprefix && !tolerant) throw new Error(`too short to parse without a \`v\` prefix: ${input}`)
      let pretty_is_raw = false
      this.components = parts.flatMap((x, index) => {
        const match = x.match(/^(\d+)([a-z])$/)
        if (match) {
          if (index != parts.length - 1) throw new Error(`invalid version: ${input}`)
          const n = parseInt(match[1])
          if (isNaN(n)) throw new Error(`invalid version: ${input}`)
          pretty_is_raw = true
          return [n, char_to_num(match[2])]
        } else if (/^\d+$/.test(x)) {
          const n = parseInt(x)  // parseInt will parse eg. `5-start` to `5`
          if (isNaN(n)) throw new Error(`invalid version: ${input}`)
          return [n]
        } else {
          throw new Error(`invalid version: ${input}`)
        }
      })
      this.raw = raw
      if (pretty_is_raw) this.pretty = raw
    } else if (input instanceof Range || input instanceof SemVer) {
      const v = input instanceof Range ? input.single() : input
      if (!v) throw new Error(`range represents more than a single version: ${input}`)
      this.components = v.components
      this.raw = v.raw
      this.pretty = v.pretty
    } else {
      this.components = input
      this.raw = input.join('.')
    }

    this.major = this.components[0]
    this.minor = this.components[1] ?? 0
    this.patch = this.components[2] ?? 0

    function char_to_num(c: string) {
      return c.charCodeAt(0) - 'a'.charCodeAt(0) + 1
    }
  }

  toString(): string {
    return this.pretty ??
      (this.components.length <= 3
        ? `${this.major}.${this.minor}.${this.patch}`
        : this.components.join('.'))
  }

  eq(that: SemVer): boolean {
    return this.compare(that) == 0
  }

  neq(that: SemVer): boolean {
    return this.compare(that) != 0
  }

  gt(that: SemVer): boolean {
    return this.compare(that) > 0
  }

  lt(that: SemVer): boolean {
    return this.compare(that) < 0
  }

  compare(that: SemVer): number {
    return _compare(this, that)
  }

  [Symbol.for("Deno.customInspect")]() {
    return this.toString()
  }
}

/// the same as the constructor but swallows the error returning undefined instead
/// also slightly more tolerant parsing
export function parse(input: string) {
  try {
    return new SemVer(input, true)
  } catch {
    return undefined
  }
}

/// we don’t support as much as node-semver but we refuse to do so because it is badness
export class Range {
  // contract [0, 1] where 0 != 1 and 0 < 1
  readonly set: ([SemVer, SemVer] | SemVer)[] | '*'

  constructor(input: string | ([SemVer, SemVer] | SemVer)[]) {
    if (input === "*") {
      this.set = '*'
    } else if (!isString(input)) {
      this.set = input
    } else {
      input = input.trim()

      const err = () => new Error(`invalid semver range: ${input}`)

      this.set = input.split(/(?:,|\s*\|\|\s*)/).map(input => {
        let match = input.match(/^>=((\d+\.)*\d+)\s*(<((\d+\.)*\d+))?$/)
        if (match) {
          const v1 = new SemVer(match[1], true)
          const v2 = match[3] ? new SemVer(match[4], true)! : new SemVer([Infinity, Infinity, Infinity])
          return [v1, v2]
        } else if ((match = input.match(/^([~=<^])(.+)$/))) {
          let v1: SemVer | undefined, v2: SemVer | undefined
          switch (match[1]) {
          case "^":
            v1 = new SemVer(match[2], true)
            v2 = new SemVer([v1.major + 1], true)
            return [v1, v2]
          case "~": {
            v1 = new SemVer(match[2], true)
            if (v1.components.length == 1) {
              // yep this is the official policy
              v2 = new SemVer([v1.major + 1], true)
            } else {
              v2 = new SemVer([v1.major, v1.minor + 1], true)
            }
          } return [v1, v2]
          case "<":
            v1 = new SemVer([0], true)
            v2 = new SemVer(match[2], true)
            return [v1, v2]
          case "=":
            return new SemVer(match[2], true)
          }
        }
        throw err()
      })

      if (this.set.length == 0) {
        throw err()
      }

      for (const i of this.set) {
        if (isArray(i) && !i[0].lt(i[1])) throw err()
      }
    }
  }

  toString(): string {
    if (this.set === '*') {
      return '*'
    } else {
      return this.set.map(v => {
        if (!isArray(v)) return `=${v.toString()}`
        const [v1, v2] = v
        if (v2.major == v1.major + 1 && v2.minor == 0 && v2.patch == 0) {
          const v = chomp(v1)
          return `^${v}`
        } else if (v2.major == v1.major && v2.minor == v1.minor + 1 && v2.patch == 0) {
          const v = chomp(v1)
          return `~${v}`
        } else if (v2.major == Infinity) {
          const v = chomp(v1)
          return `>=${v}`
        } else {
          return `>=${chomp(v1)}<${chomp(v2)}`
        }
      }).join(",")
    }
  }

  // eq(that: Range): boolean {
  //   if (this.set.length !== that.set.length) return false
  //   for (let i = 0; i < this.set.length; i++) {
  //     const [a,b] = [this.set[i], that.set[i]]
  //     if (typeof a !== 'string' && typeof b !== 'string') {
  //       if (a[0].neq(b[0])) return false
  //       if (a[1].neq(b[1])) return false
  //     } else if (a != b) {
  //       return false
  //     }
  //   }
  //   return true
  // }

  satisfies(version: SemVer): boolean {
    if (this.set === '*') {
      return true
    } else {
      return this.set.some(v => {
        if (isArray(v)) {
          const [v1, v2] = v
          return version.compare(v1) >= 0 && version.compare(v2) < 0
        } else {
          return version.eq(v)
        }
      })
    }
  }

  max(versions: SemVer[]): SemVer | undefined {
    return versions.filter(x => this.satisfies(x)).sort((a,b) => a.compare(b)).pop()
  }

  single(): SemVer | undefined {
    if (this.set === '*') return
    if (this.set.length > 1) return
    return isArray(this.set[0]) ? undefined : this.set[0]
  }

  [Symbol.for("Deno.customInspect")]() {
    return this.toString()
  }
}

function zip<T, U>(a: T[], b: U[]) {
  const N = Math.max(a.length, b.length)
  const rv: [T | undefined, U | undefined][] = []
  for (let i = 0; i < N; ++i) {
    rv.push([a[i], b[i]])
  }
  return rv
}

function _compare(a: SemVer, b: SemVer): number {
  for (const [c,d] of zip(a.components, b.components)) {
    if (c != d) return (c ?? 0) - (d ?? 0)
  }
  return 0
}
export { _compare as compare }


export function intersect(a: Range, b: Range): Range {
  if (b.set === '*') return a
  if (a.set === '*') return b

  // calculate the intersection between two semver.Ranges
  const set: ([SemVer, SemVer] | SemVer)[] = []

  for (const aa of a.set) {
    for (const bb of b.set) {
      if (!isArray(aa) && !isArray(bb)) {
        if (aa.eq(bb)) set.push(aa)
      } else if (!isArray(aa)) {
        const bbb = bb as [SemVer, SemVer]
        if (aa.compare(bbb[0]) >= 0 && aa.lt(bbb[1])) set.push(aa)
      } else if (!isArray(bb)) {
        const aaa = aa as [SemVer, SemVer]
        if (bb.compare(aaa[0]) >= 0 && bb.lt(aaa[1])) set.push(bb)
      } else {
        const a1 = aa[0]
        const a2 = aa[1]
        const b1 = bb[0]
        const b2 = bb[1]

        if (a1.compare(b2) >= 0 || b1.compare(a2) >= 0) {
          continue
        }

        set.push([a1.compare(b1) > 0 ? a1 : b1, a2.compare(b2) < 0 ? a2 : b2])
      }
    }
  }

  if (set.length <= 0) throw new Error(`cannot intersect: ${a} && ${b}`)

  return new Range(set)
}


//FIXME yes yes this is not sufficient
export const regex = /\d+\.\d+\.\d+/

function chomp(v: SemVer) {
  return v.toString().replace(/(\.0)+$/g, '') || '0'
}
