import SemVer, { Range as SemVerRange } from "semver"
import Path from "path"

export interface Package {
  project: string
  version: SemVer
}

export interface PackageRequirement {
  project: string
  constraint: SemVerRange
}

export interface Installation {
  path: Path
  pkg: Package
}

export enum Verbosity {
  quiet = -1,
  normal = 0,
  loud = 1,
  debug = 2,
  trace = 3
}
