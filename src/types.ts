import Path from "./types/Path.ts"
export { Path }

import { PlainObject } from "is_what"
export type { PlainObject }

export interface Package {
  project: string
  version: SemVer
}

export interface PackageRequirement {
  project: string
  constraint: semver.Range
}

export interface Installation {
  path: Path
  pkg: Package
}

export interface Distributable {
  url: string
  pkg: Package
  type: DistributableType
  platform?: Platform
}

export type BinaryType =
  'x86_64' |
  'aarch64'   // AKA arm64, notably: Apple Silicon

export type DistributableType = BinaryType[] | 'source-code'

// when we support more variants of these that require specification
// we will tuple a version in with each eg. 'darwin' | ['windows', 10 | 11 | '*']
export type Platform = 'darwin' | 'linux' | 'windows'

export function parsePackageRequirement(input: string): PackageRequirement {
  const splat = input.split('@')
  switch (splat.length) {
  case 1:
    return {
      project: input,
      constraint: new semver.Range('*')
    }
  case 2:
    return {
      project: splat[0],
      constraint: new semver.Range(splat[1])
    }
  default:
    throw "invalid-pkgspec"
  }
}

/////////////////////////////////////////////////////////////////////// semver
import SemVer, * as semver from "semver"

//TODO I expect this is inefficient AF
//FIXME strictly this isn’t valid since ranges can have holes, but we don’t allow holes
function semver_intersection(a: semver.Range, b: semver.Range): semver.Range {
  throw new Error("unimpl")
}

export { SemVer, semver, semver_intersection }

export enum Verbosity {
  quiet = -1,
  normal = 0,
  loud = 1,
  debug = 2,
  trace = 3
}

export type Bluff<T> = T | Promise<T>
