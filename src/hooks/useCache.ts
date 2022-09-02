import { Package, Path, semver } from "types"
import * as utils from "utils"
import usePlatform from "hooks/usePlatform.ts"
import * as _ from "utils" // console.verbose

interface DownloadOptions {
  url: string
  pkg: Package
  type?: 'src' | 'bottle'
}

const prefix = new Path("/opt/tea.xyz/var/www")

export default function useCache() {
  return { download, bottle, ls, s3Key }
}

const stem = (pkg: Package) => {
  const name = pkg.project.replaceAll("/", "∕")
  // ^^ OHAI, we’re replacing folder slashes with unicode slashes
  return `${name}-${pkg.version}`
}

/// destination for bottle downloads
const bottle = (pkg: Package) => {
  const { arch, platform } = usePlatform()
  return prefix.join(`${stem(pkg)}+${platform}+${arch}.tar.gz`)
}

/// download source or bottle
const download = async ({ url: readURL, pkg, type = 'bottle' }: DownloadOptions) => {
  const filename = (() => {
    switch(type!) {
      case 'src': return stem(pkg) + Path.extname(readURL)
      case 'bottle': return bottle(pkg).string
    }
  })()
  const writeFilename = prefix.join(filename)
  console.debug(writeFilename)
  if (writeFilename.isReadableFile()) {
    console.info({alreadyDownloaded: writeFilename})
  } else {
    console.info({downloading: readURL})
    await grab({ readURL, writeFilename })
  }
  return writeFilename
}

/// lists all packages with bottles in the cache
const ls = async () => {
  const { arch, platform } = usePlatform()

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

  return rv.sort(utils.packageSort)
}

/// key used when downloading from our S3 bottle storage
const s3Key = (pkg: Package) => {
  const { platform, arch } = usePlatform()
  return `${pkg.project}/${platform}/${arch}/v${pkg.version.version}.tar.gz`
}

async function grab({ readURL, writeFilename }: { readURL: string, writeFilename: Path }) {
  const { verbose } = console

  if (writeFilename.isReadableFile()) return

  verbose({downloading: readURL})
  verbose({destination: writeFilename})

  const file = await utils.download(readURL)
  await Deno.link(file.path, writeFilename.string)
}
