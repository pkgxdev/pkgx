import { useDownload, usePrefix, useOffLicense } from "hooks"
import { Package, Stowed, SupportedArchitectures, SupportedPlatform, Stowage } from "types"
import * as utils from "utils"
import SemVer from "semver"
import Path from "path"

export default function useCache() {
  return { download, ls, path, decode }
}

type DownloadOptions = {
  type: 'bottle'
  pkg: Package
} | {
  type: 'src',
  url: URL
  pkg: Package
} | {
  type: 'script',
  url: URL
}

/// download source or bottle
const download = async (opts: DownloadOptions) => {
  const { download } = useDownload()

  const { type } = opts
  let url: URL
  if (type == 'bottle') {
    url = useOffLicense('s3').url({ pkg: opts.pkg, type: 'bottle', compression: 'gz' })
  } else {
    url = opts.url
  }

  const headers: HeadersInit = {}
  let dst: Path | undefined
  switch (type) {
  case 'bottle':
    dst = path({ pkg: opts.pkg, type: 'bottle', compression: 'gz' })
    break
  case 'src': {
    const extname = new Path(url.pathname).extname()
    dst = path({ pkg: opts.pkg, type: 'src', extname })
  } break
  case 'script':
    dst = undefined
  }

  return await download({ src: url, dst, headers })
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
  const match = path.basename().match(`^(.*)-([0-9]+\\.[0-9]+\\.[0-9]+)(\\+(.+?)\\+(.+?))?\\.tar\\.[gx]z$`)
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
          arch: arch as SupportedArchitectures
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
