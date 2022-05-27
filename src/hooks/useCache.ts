import { copy, readerFromStreamReader } from "deno/streams/mod.ts"
import { Package, Path } from "types"
import usePlatform from "hooks/usePlatform.ts"

interface DownloadOptions {
  url: string
  pkg: Package
}

interface Response {
  stem(pkg: Package): string
  download(opts: DownloadOptions): Promise<Path>
}

export default function useCache(): Response {
  const stem = (pkg: Package) => {
    const name = pkg.project.replaceAll("/", "∕")
    // ^^ OHAI, we’re replacing folder slashes with unicode slashes
    const build = usePlatform().arch
    return `${name}-${pkg.version}+${build}`
  }

  const download = async ({ url: readURL, pkg }: DownloadOptions) => {
    const extension = Path.extname(readURL)
    const filename = stem(pkg) + extension
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

  return { download, stem }
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
