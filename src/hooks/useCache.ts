import { usePrefix } from "hooks"
import { Package, Stowage } from "types"
import * as utils from "utils"

export default function useCache() {
  return { path }
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
