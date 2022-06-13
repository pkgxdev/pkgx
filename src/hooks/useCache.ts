import { copy, readerFromStreamReader } from "deno/streams/mod.ts"
import { Package, Path } from "types"
import usePlatform from "hooks/usePlatform.ts"
import * as _ from "utils" // console.verbose

interface DownloadOptions {
  url: string
  pkg: Package
  type?: 'src' | 'bottle'
}

interface Response {
  bottle(pkg: Package): Path
  download(opts: DownloadOptions): Promise<Path>
}

export default function useCache(): Response {
  const prefix = new Path("/opt/tea.xyz/var/www")
  const stem = (pkg: Package) => {
    const name = pkg.project.replaceAll("/", "∕")
    // ^^ OHAI, we’re replacing folder slashes with unicode slashes
    return `${name}-${pkg.version}`
  }

  const src = (pkg: Package) => `${stem(pkg)}+src`
  const bottle = (pkg: Package) => {
    const { arch } = usePlatform()
    return prefix.join(`${stem(pkg)}+${arch}.tar.gz`)
  }

  const download = async ({ url: readURL, pkg, type = 'bottle' }: DownloadOptions) => {
    const extension = Path.extname(readURL)
    const stem = () => {
      switch(type!) {
      case 'src': return src(pkg)
      case 'bottle': return bottle(pkg)
      }
    }
    const filename = stem() + extension
    const writeFilename = new Path("/opt/tea.xyz/var/www").join(filename)
    console.debug(writeFilename)
    if (writeFilename.isReadableFile()) {
      console.info({alreadyDownloaded: writeFilename})
    } else {
      console.info({downloading: readURL})
      await grab({ readURL, writeFilename })
    }
    return writeFilename
  }

  return { download, bottle }
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
