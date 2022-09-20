import { useDownload } from "hooks"
import { Package } from "types"
import Path from "path"
import * as semver from "semver"
import * as utils from "utils"

interface DownloadOptions {
  url: URL
  pkg: Package
  type?: 'src' | 'bottle'
}

const { prefix } = useDownload()

export default function useCache() {
  return { download: my_download, bottle, ls, s3Key, prefix, download_script }
}

const stem = (pkg: Package) => {
  const name = pkg.project.replaceAll("/", "∕")
  // ^^ OHAI, we’re replacing folder slashes with unicode slashes
  return `${name}-${pkg.version}`
}

/// destination for bottle downloads
const bottle = (pkg: Package) => {
  const { arch, platform } = utils.host()
  return prefix.join(`${stem(pkg)}+${platform}+${arch}.tar.gz`)
}

/// download source or bottle
const my_download = async ({ url, pkg, type = 'bottle' }: DownloadOptions) => {
  const filename = (() => {
    switch(type) {
      case 'src': return stem(pkg) + Path.extname(url.pathname)
      case 'bottle': return bottle(pkg).string
    }
  })()
  const download = useDownload().download
  const dst = prefix.join(filename)
  const headers: HeadersInit = {}

  if (pkg.project === "tea.xyz") {
    //FIXME: big hacks
    if (url.host != "github.com") { throw new Error("unknown private domain") }
    const token = Deno.env.get("GITHUB_TOKEN")
    if (!token) { throw new Error("private repos require a GITHUB_TOKEN") }
    headers["Authorization"] = `bearer ${token}`
  }

  return await download({ src: url, dst, headers })
}

const download_script = async (url: URL) => {
  const { download } = useDownload()
  return await download({ src: url })
}

/// lists all packages with bottles in the cache
const ls = async () => {
  const { arch, platform } = utils.host()

  const rv = []

  for await (const file of prefix.ls()) {
    const match = file[1].name.match(`^(.*)-([0-9]+\\.[0-9]+\\.[0-9]+)\\+${platform}\\+${arch}\\.tar\\.gz$`)
    if (!match) { continue }
    const [_, p, v] = match
    // Gotta undo the package name manipulation to get the package from the bottle
    const project = p.replaceAll("∕", "/")
    const version = semver.coerce(v)
    if (!version) { continue }
    rv.push({ project, version })
  }

  return rv.sort(utils.compare_pkg)
}

/// key used when downloading from our S3 bottle storage
const s3Key = (pkg: Package) => {
  const { platform, arch } = utils.host()
  return `${pkg.project}/${platform}/${arch}/v${pkg.version.version}.tar.gz`
}
