import { Package, Path, semver } from "types"
import * as utils from "utils"
import usePlatform from "hooks/usePlatform.ts"
import * as _ from "utils" // console.verbose
import useCellar from "hooks/useCellar.ts"

interface DownloadOptions {
  url: string
  pkg: Package
  type?: 'src' | 'bottle'
}

const prefix = new Path(`${useCellar().prefix}/tea.xyz/var/www`)

export default function useCache() {
  return { download, bottle, ls, s3Key, prefix, download_script }
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
    //FIXME: big hacks
    const privateRepo = pkg.project === "tea.xyz"
    await grab({ readURL, writeFilename, privateRepo })
  }
  return writeFilename
}

const download_script = async (url: URL) => {
  const file = await dl(url)
  return new Path(file.path)
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

async function grab({ readURL, writeFilename, privateRepo = false }: { readURL: string, writeFilename: Path, privateRepo: boolean }) {
  const { verbose } = console

  if (writeFilename.isReadableFile()) return

  verbose({downloading: readURL})
  verbose({destination: writeFilename})

  //TODO: remove; special casing for private tea repos
  if (privateRepo) {
    const url = new URL(readURL)
    if (url.host != "github.com") { throw new Error("unknown private domain") }
    const token = Deno.env.get("GITHUB_TOKEN")
    if (!token) { throw new Error("private repos require a GITHUB_TOKEN") }
    const rsp = await fetch(url, { headers: { authorization: `bearer ${token}`} })
    const file = await Deno.open(writeFilename.string, { create: true, write: true })
    await rsp.body?.pipeTo(file.writable)
    return
  }
  const file = await dl(readURL)
  await Deno.link(file.path, writeFilename.string)
}


///////////////////////////////////////////////////////////////////////// HTTP
import { cache, File, Policy, configure } from "mxcl/deno-cache"

//FIXME lol better
configure({ directory: prefix.string })

function dl(
  url: string | URL,
  policy?: Policy,
  ns?: string,
): Promise<File> {
  return cache(url, policy, ns)
}
