import SemVer, { Range as SemVerRange } from "semver"
import Path from "path"
import { host } from "./utils/index.ts"

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
export const SupportedPlatforms = ["darwin" , "linux" , "windows" , "freebsd" , "netbsd" , "aix" , "solaris" , "illumos"] as const
export type SupportedPlatform = typeof SupportedPlatforms[number]

export const SupportedArchitectures = ["x86-64", "aarch64"] as const
export type SupportedArchitecture = typeof SupportedArchitectures[number]

/// remotely available package content (bottles or source tarball)
export type Stowage = {
  type: 'src'
  pkg: Package
  extname: string
} | {
  type: 'bottle'
  pkg: Package
  compression: 'xz' | 'gz'
  host?: { platform: SupportedPlatform, arch: SupportedArchitecture }
}

/// once downloaded, `Stowage` becomes `Stowed`
export type Stowed = Stowage & { path: Path }

export function StowageNativeBottle(opts: { pkg: Package, compression: 'xz' | 'gz' }): Stowage {
  return { ...opts, host: host(), type: 'bottle' }
}

// ExitError will cause the application to exit with the specified exit code if it bubbles
// up to the main error handler
export class ExitError extends Error {
  code: number
  constructor(code: number) {
    super(`exiting with code: ${code}`)
    this.code = code
  }
}

export type WhichResult = PackageRequirement & {
  explicit?: Path
  shebang?: string | string[]
  precmd?: string[]
}
