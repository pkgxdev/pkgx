import { Stowage } from "types"
import { host } from "utils"
import Path from "path"

type Type = 's3'

export default function useOffLicense(_type: Type) {
  return { url, key }
}

function key(stowage: Stowage) {
  let rv = Path.root.join(stowage.pkg.project)
  if (stowage.type == 'bottle') {
    const { platform, arch } = stowage.host ?? host()
    rv = rv.join(`${platform}/${arch}`)
  }
  let fn = `v${stowage.pkg.version}`
  if (stowage.type == 'bottle') {
    fn += `.tar.${stowage.compression}`
  } else {
    fn +=  stowage.extname
  }
  return rv.join(fn).string
}

function url(stowage: Stowage) {
  return new URL(`https://dist.tea.xyz${key(stowage)}`)
}
