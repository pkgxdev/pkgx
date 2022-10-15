import { readerFromStreamReader, copy } from "deno/streams/conversion.ts"
import { useFlags, usePrefix } from "hooks"
import { panic } from "utils"
import { Sha256 } from "deno/hash/sha256.ts"
import Path from "path"

interface DownloadOptions {
  src: URL
  dst?: Path  /// default is our own unique cache path
  headers?: Record<string, string>
  ephemeral?: boolean  /// always download, do not rely on cache
}

interface RV {
  path: Path

  // we only give you the sha if we download
  // if we found the cache then you have to calculate the sha yourself
  sha: string | undefined
}

async function internal<T>({ src, dst, headers, ephemeral }: DownloadOptions,
  body: (src: ReadableStream<Uint8Array>, dst: Deno.Writer) => Promise<T>): Promise<Path>
{
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
    const f = await Deno.open(dst.string, {create: true, write: true, truncate: true})
    try {
      dst.parent().mkpath()
      await body(reader, f)

      //TODO etags too
      const text = rsp.headers.get("Last-Modified")
      if (text) mtime_entry().write({ text, force: true })

    } finally {
      f.close()
    }
  } break
  case 304:
    console.verbose("304: not modified")
    break
  default:
    if (!numpty || !dst.isFile()) {
      throw new Error(`${rsp.status}: ${src}`)
    }
  }

  return dst
}

async function download(opts: DownloadOptions): Promise<Path> {
  return await internal(opts, (src, dst) => copy(readerFromStreamReader(src.getReader()), dst))
}

async function download_with_sha(opts: DownloadOptions): Promise<{path: Path, sha: string}> {
  const digest = new Sha256()
  let run = false

  const path = await internal(opts, (src, dst) => {
    run = true
    const tee = src.tee()
    const p1 = copy(readerFromStreamReader(tee[0].getReader()), dst)
    const p2 = copy(readerFromStreamReader(tee[1].getReader()), { write: buf => {
      //TODO in separate thread would be likely be faster
      digest.update(buf)
      return Promise.resolve(buf.length)
    }})
    return Promise.all([p1, p2])
  })

  if (!run) {
    console.info({ verifying: path })
    const f = await Deno.open(path.string, { read: true })
    await copy(f, { write: buf => {
      //TODO in separate thread would likely be faster
      digest.update(buf)
      return Promise.resolve(buf.length)
    }})
  }

  return { path, sha: digest.hex() }
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
  return { download, hash_key, download_with_sha }
}
