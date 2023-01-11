import { readerFromStreamReader, copy } from "deno/streams/conversion.ts"
import { Logger, teal, gray } from "./useLogger.ts"
import { chuzzle, error, TeaError } from "utils"
import { Sha256 } from "deno/hash/sha256.ts"
import { usePrefix } from "hooks"
import { isString } from "is_what"
import Path from "path"


interface DownloadOptions {
  src: URL
  dst?: Path  /// default is our own unique cache path
  headers?: Record<string, string>
  logger?: Logger | string
}

interface RV {
  path: Path

  // we only give you the sha if we download
  // if we found the cache then you have to calculate the sha yourself
  sha: string | undefined
}

async function internal<T>({ src, dst, headers, logger }: DownloadOptions,
  body: (src: ReadableStream<Uint8Array>, dst: Deno.Writer, sz?: number) => Promise<T>): Promise<Path>
{
  if (isString(logger)) {
    logger = new Logger(logger)
  } else if (!logger) {
    logger = new Logger()
  }

  console.verbose({src: src, dst})

  const hash = (() => {
    let memo: Path
    return () => memo ?? (memo = hash_key(src))
  })()
  const mtime_entry = () => hash().join("mtime")
  const etag_entry = () => hash().join("etag")

  dst ??= hash().join(src.path().basename())
  if (src.protocol === "file:") throw new Error()

  if (dst.isReadableFile()) {
    headers ??= {}
    if (etag_entry().isFile()) {
      headers["If-None-Match"] = await etag_entry().read()
    } else if (mtime_entry().isFile()) {
      headers["If-Modified-Since"] = await mtime_entry().read()
    }
    logger.replace(teal('querying'))
  } else {
    logger.replace(teal('downloading'))
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
    const sz = chuzzle(parseInt(rsp.headers.get("Content-Length")!))

    let txt = teal('downloading')
    if (sz) txt += ` ${gray(pretty_size(sz))}`
    logger.replace(txt)

    const reader = rsp.body ?? error.panic()
    dst.parent().mkpath()
    const f = await Deno.open(dst.string, {create: true, write: true, truncate: true})

    try {
      await body(reader, f, sz)

      const text = rsp.headers.get("Last-Modified")
      const etag = rsp.headers.get("ETag")

      if (text) mtime_entry().write({text, force: true})
      if (etag) etag_entry().write({text: etag, force: true})

    } finally {
      f.close()
    }
  } break
  case 304:
    logger.replace(`cache: ${teal('hit')}`)
    break
  default:
    throw new Error(`${rsp.status}: ${src}`)
  }

  return dst
}

async function download(opts: DownloadOptions): Promise<Path> {
  try {
    return await internal(opts, (src, dst) => copy(readerFromStreamReader(src.getReader()), dst))
  } catch (cause) {
    throw new TeaError('http', {cause, ...opts})
  }
}

async function download_with_sha({ logger, ...opts}: DownloadOptions): Promise<{path: Path, sha: string}> {
  if (isString(logger)) {
    logger = new Logger(logger)
  } else if (!logger) {
    logger = new Logger()
  }

  const digest = new Sha256()
  let run = false

  // don’t fill CI logs with dozens of download percentage lines
  const ci = Deno.env.get("CI")

  const path = await internal({...opts, logger}, (src, dst, sz) => {
    let n = 0

    run = true
    const tee = src.tee()
    const p1 = copy(readerFromStreamReader(tee[0].getReader()), dst)
    const p2 = copy(readerFromStreamReader(tee[1].getReader()), { write: buf => {
      //TODO in separate thread would be likely be faster
      digest.update(buf)
      if (sz && !ci) {
        n += buf.length
        const pc = Math.round(n / sz * 100);
        (logger as Logger).replace(`${teal('downloading')} ${pc}%`)
      } else if (!ci) {
        (logger as Logger).replace(`${teal('downloading')} ${pretty_size(n)}`)
      }
      return Promise.resolve(buf.length)
    }})
    return Promise.all([p1, p2])
  })

  if (!run) {
    logger.replace(teal('verifying'))
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
  return {
    download,
    hash_key,
    download_with_sha: error.wrap(download_with_sha, 'http')
  }
}

function pretty_size(n: number) {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"]
  let i = 0
  while (n > 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  const precision = n < 10 ? 2 : n < 100 ? 1 : 0
  return `${n.toFixed(precision)} ${units[i]}`
}
