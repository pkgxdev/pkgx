import { copy, readerFromStreamReader } from "deno/streams/mod.ts"
import { Package, Path, semver } from "types"
import { packageSort } from "utils"
import usePlatform from "hooks/usePlatform.ts"
import * as _ from "utils" // console.verbose

interface DownloadOptions {
  url: string
  pkg: Package
  type?: 'src' | 'bottle'
}

interface Response {
  bottle(pkg: Package): Path
  s3Key(pkg: Package): string
  download(opts: DownloadOptions): Promise<Path>
  ls(): Promise<Package[]>
}

export default function useCache(): Response {
  const prefix = new Path("/opt/tea.xyz/var/www")
  const stem = (pkg: Package) => {
    const name = pkg.project.replaceAll("/", "∕")
    // ^^ OHAI, we’re replacing folder slashes with unicode slashes
    return `${name}-${pkg.version}`
  }

  const bottle = (pkg: Package) => {
    const { arch } = usePlatform()
    return prefix.join(`${stem(pkg)}+${arch}.tar.gz`)
  }

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

  const ls = async () => {
    const { arch } = usePlatform()

    const rv = []

    for await (const file of prefix.ls()) {
      const match = file[1].name.match(`^(.*)-([0-9]+\\.[0-9]+\\.[0-9]+)\\+${arch}\\.tar\\.gz$`)
      if (!match) { continue }
      const [_, p, v] = match
      // Gotta undo the package name manipulation to get the package from the bottle
      const project = p.replaceAll("∕", "/")
      const version = semver.coerce(v)
      if (!version) { continue }
      rv.push({ project, version })
    }

    return rv.sort(packageSort)
  }

  const s3Key = (pkg: Package) => {
    const { platform, arch } = usePlatform()
    return `${pkg.project}/${platform}/${arch}/v${pkg.version.version}.tar.gz`
  }

  return { download, bottle, ls, s3Key }
}

async function grab({ readURL, writeFilename }: { readURL: string, writeFilename: Path }) {
  const { verbose } = console

  if (writeFilename.isReadableFile()) return

  verbose({downloading: readURL})
  verbose({destination: writeFilename})

  const rsp = await fetch(readURL)
  if (!rsp.ok) throw "404-not-found"  //TODO
  const rdr = rsp.body?.getReader()
  if (!rdr) throw new Error(`Couldn’t read: ${readURL}`)
  const r = readerFromStreamReader(rdr)
  const f = await Deno.open(writeFilename.mkparent().string, {create: true, write: true})
  try {
    await copy(r, f)
  } finally {
    f.close()
  }
}
