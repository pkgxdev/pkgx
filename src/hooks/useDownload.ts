import { readerFromStreamReader, copy } from "deno/streams/conversion.ts"
import { useFlags, usePrefix } from "hooks"
import { flatmap, panic } from "utils"
import { Sha256 } from "deno/hash/sha256.ts"
import Path from "path"

interface DownloadOptions {
  src: URL
  dst?: Path  /// default is our own unique cache path
  headers?: Record<string, string>
  ephemeral?: boolean  /// always download, do not rely on cache
  mehsha?: boolean
}

interface RV {
  path: Path

  // we only give you the sha if we download
  // if we found the cache then you have to calculate the sha yourself
  sha: string | undefined
}

async function download({ src, dst, headers, ephemeral, ...opts }: DownloadOptions): Promise<RV> {
  console.verbose({src: src, dst})

  const hash = (() => {
    let memo: Path
    return () => memo ?? (memo = hash_key(src))
  })()
  const mtime_entry = () => hash().join("mtime")

  const { numpty } = useFlags()
  dst ??= hash().join(src.path().basename())
  if (src.protocol === "file:") throw new Error()

  if (!ephemeral && mtime_entry().isFile() && dst.isReadableFile()) {
    headers ??= {}
    headers["If-Modified-Since"] = await mtime_entry().read()
    console.info({querying: src.toString()})
  } else {
    console.info({downloading: src.toString()})
  }

  // so the user can add private repos if they need to etc.
  if (/(^|\.)github.com$/.test(src.host)) {
    const token = Deno.env.get("GITHUB_TOKEN")
    if (token) {
      headers ??= {}
      headers["Authorization"] = `bearer ${token}`
    }
  }

  const rsp = await fetch(src, {headers})

  switch (rsp.status) {
  case 200: {
    if ("If-Modified-Since" in (headers ?? {})) {
      console.info({downloading: src})
    }

    const reader = rsp.body ?? panic()

    dst.parent().mkpath()
    const f = await Deno.open(dst.string, {create: true, write: true, truncate: true})
    try {
      const sha = await stream(reader, f, opts.mehsha)

      //TODO etags too
      flatmap(rsp.headers.get("Last-Modified"), text =>
        mtime_entry().write({ text, force: true }))

      console.verbose({ downloaded: dst, sha })

      return { path: dst, sha }

    } finally {
      f.close()
    }
  }
  case 304:
    console.verbose("304: not modified")
    return { path: dst, sha: undefined }
  default:
    if (numpty && dst.isFile()) {
      return { path: dst, sha: undefined }
    } else {
      throw new Error(`${rsp.status}: ${src}`)
    }
  }
}

async function stream(src: ReadableStream<Uint8Array>, dst: Deno.Writer, hash: boolean | undefined): Promise<string | undefined> {
  //NOTE copy takes a buf size arg that we may want to try optimizing

  if (!hash) {
    return copy(readerFromStreamReader(src.getReader()), dst).then(() => undefined)
  } else {
    const digest = new Sha256()
    const tee = src.tee()

    const p1 = copy(readerFromStreamReader(tee[0].getReader()), { write: buf => {
      //TODO in separate thread would be likely be faster
      digest.update(buf)
      return Promise.resolve(buf.length)
    }})

    const p2 = copy(readerFromStreamReader(tee[1].getReader()), dst)

    await Promise.all([p1, p2])

    return digest.hex()
  }
}

function hash_key(url: URL): Path {
  function hash(url: URL) {
    const formatted = `${url.pathname}${url.search ? "?" + url.search : ""}`
    return new Sha256().update(formatted).toString()
  }

  const prefix = usePrefix().www

  return prefix
    .join(url.protocol.slice(0, -1))
    .join(url.hostname)
    .join(hash(url))
    .mkpath()
}

export default function useDownload() {
  return { download, hash_key }
}
