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

export type PackageSpecification = Package | PackageRequirement

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

// when we support more variants of these that require specification
// we will tuple a version in with each eg. 'darwin' | ['windows', 10 | 11 | '*']
export const SupportedPlatforms = ["darwin", "linux", "windows"] as const
export type SupportedPlatform = typeof SupportedPlatforms[number]

export type SupportedArchitectures = 'x86-64' | 'aarch64'

/// remotely available package content (bottles or source tarball)
export type Stowage = {
  type: 'src'
  pkg: Package
  extname: string
} | {
  type: 'bottle'
  pkg: Package
  compression: 'xz' | 'gz'
  host?: { platform: SupportedPlatform, arch: SupportedArchitectures }
}

/// once downloaded, `Stowage` becomes `Stowed`
export type Stowed = Stowage & { path: Path }
