import { usePrefix } from "hooks"
import { Package, Stowed, SupportedArchitecture, SupportedPlatform, Stowage } from "types"
import * as utils from "utils"
import SemVer from "semver"
import Path from "path"

export default function useCache() {
  return { ls, path, decode }
}

type DownloadOptions = {
  type: 'bottle'
  pkg: Package
} | {
  type: 'src',
  url: URL
  pkg: Package
}

const path = (stowage: Stowage) => {
  const { pkg, type } = stowage
  const stem = pkg.project.replaceAll("/", "∕")

  let filename = `${stem}-${pkg.version}`
  if (type == 'bottle') {
    const { platform, arch } = stowage.host ?? utils.host()
    filename += `+${platform}+${arch}.tar.${stowage.compression}`
  } else {
    filename += stowage.extname
  }

  return usePrefix().www.join(filename)
}

function decode(path: Path): Stowed | undefined {
  const match = path.basename().match(`^(.*)-(\\d+\\.\\d+\\.\\d+.*?)(\\+(.+?)\\+(.+?))?\\.tar\\.[gx]z$`)
  if (!match) return
    const [_, p, v, host, platform, arch] = match
    // Gotta undo the package name manipulation to get the package from the bottle
    const project = p.replaceAll("∕", "/")
    const version = new SemVer(v)
    if (!version) return
    const pkg = { project, version }
    if (host) {
      const compression = path.extname() == '.tar.gz' ? 'gz' : 'xz'
      return {
        pkg,
        type: 'bottle',
        host: {
          platform: platform as SupportedPlatform,
          arch: arch as SupportedArchitecture
        },
        compression,
        path
      }
    } else {
      return {
        pkg, type: 'src', path,
        extname: path.extname(),
      }
    }
}

const ls = async () => {
  const rv: Stowed[] = []
  for await (const [path] of usePrefix().www.ls()) {
    const stowed = decode(path)
    if (stowed) rv.push(stowed)
  }
  return rv
}
