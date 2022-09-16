import { Package, Path, semver } from "types"
import * as utils from "utils"
import usePlatform from "hooks/usePlatform.ts"
import * as _ from "utils" // console.verbose
import useCellar from "hooks/useCellar.ts"

interface DownloadOptions {
  url: URL
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
    switch(type) {
      case 'src': return stem(pkg) + Path.extname(readURL.pathname)
      case 'bottle': return bottle(pkg).string
    }
  })()
  const writeFilename = prefix.join(filename)
  const privateRepo = pkg.project === "tea.xyz" //FIXME: big hacks
  await grab({ readURL, writeFilename, privateRepo })
  return writeFilename
}

const download_script = async (url: URL) => {
  const writeFilename = hash_key(url).join(new Path(url.pathname).basename())
  await grab({ readURL: url, writeFilename, privateRepo: false })
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

import { readerFromStreamReader, copy } from "deno/streams/conversion.ts"

async function grab({ readURL: url, writeFilename: dst, privateRepo = false }: { readURL: URL, writeFilename: Path, privateRepo: boolean }) {

  if (url.protocol === "file:") throw new Error()

  const { verbose } = console

  verbose({src: url, dst})

  const headers: HeadersInit = {}

  //TODO: remove; special casing for private tea repos
  if (privateRepo) {
    if (url.host != "github.com") { throw new Error("unknown private domain") }
    const token = Deno.env.get("GITHUB_TOKEN")
    if (!token) { throw new Error("private repos require a GITHUB_TOKEN") }
    headers["Authorization"] = `bearer ${token}`
  }

  const mtime_entry = hash_key(url).join("mtime")
  if (mtime_entry.isFile() && dst.isReadableFile()) {
    headers["If-Modified-Since"] = await mtime_entry.read()
  }

  const rsp = await fetch(url, { headers })

  switch (rsp.status) {
  case 200: {
    const rdr = rsp.body?.getReader()
    if (!rdr) throw new Error()
    const r = readerFromStreamReader(rdr)
    const f = await Deno.open(dst.string, {create: true, write: true})
    try {
      await copy(r, f)
    } finally {
      f.close()
    }

    //TODO etags too
    utils.flatMap(rsp.headers.get("Last-Modified"), text => mtime_entry.write({ text }))

  } break
  case 304:
    console.verbose("304: not modified")
    return  // not modified
  case 404:
    throw new Error(`404: ${url}`)
  default:
    throw new Error()
  }
}

import { createHash } from "deno/hash/mod.ts"

function hash_key(url: URL): Path {
  function hash(url: URL) {
    const formatted = `${url.pathname}${url.search ? "?" + url.search : ""}`;
    return createHash("sha256").update(formatted).toString();
  }

  return prefix
    .join(url.protocol.slice(0, -1))
    .join(url.hostname)
    .join(hash(url))
    .mkpath()
}
