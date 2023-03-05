import { readerFromStreamReader } from "deno/streams/reader_from_stream_reader.ts"
import { copy } from "deno/streams/copy.ts"
import { Logger, teal, gray } from "./useLogger.ts"
import { chuzzle, error, TeaError } from "utils"
import { crypto, toHashString } from "deno/crypto/mod.ts";
import { useFlags, usePrefix } from "hooks"
import { isString } from "is_what"
import Path from "path"


interface DownloadOptions {
  src: URL
  headers?: Record<string, string>
  logger?: Logger | string
}

interface RV {
  path: Path

  // we only give you the sha if we download
  // if we found the cache then you have to calculate the sha yourself
  sha: string | undefined
}

async function internal<T>({ src, headers, logger }: DownloadOptions,
  body?: (src: ReadableStream<Uint8Array>) => Promise<T>): Promise<[Path, T?]>
{
  logger = isString(logger) ? new Logger(logger) : logger ?? new Logger()

  const hash = hash_key(src)
  const mtime_entry = hash.join("mtime")
  const etag_entry = hash.join("etag")

  const dst = hash.join(src.path().basename())
  if (src.protocol === "file:") throw new Error()

  console.verbose({src: src, dst})

  if (dst.isReadableFile()) {
    headers ??= {}
    if (etag_entry.isFile()) {
      headers["If-None-Match"] = await etag_entry.read()
    } else if (mtime_entry.isFile()) {
      headers["If-Modified-Since"] = await mtime_entry.read()
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
      let t: T | undefined
      const show_stats = !Deno.env.get('CI') && !useFlags().silent
      if (body && !show_stats) {
        const tee = reader.tee()
        const p1 = body(tee[0])
        const p2 = reader.pipeTo(f.writable);
        [t] = await Promise.all([p1, p2])
      } else if (body) {
        const tee = reader.tee()
        const p1 = body(tee[0])
        let n = 0
        const p2 = copy(readerFromStreamReader(tee[1].getReader()), { write: buf => {
          if (sz) {
            n += buf.length
            const pc = Math.round(n / sz * 100);
            (logger as Logger).replace(`${teal('downloading')} ${pc}%`)
          } else {
            (logger as Logger).replace(`${teal('downloaded')} ${pretty_size(n)}`)
          }
          return f.write(buf)
        }});
        [t] = await Promise.all([p1, p2])
      } else {
        await reader.pipeTo(f.writable)
      }

      const text = rsp.headers.get("Last-Modified")
      const etag = rsp.headers.get("ETag")

      if (text) mtime_entry.write({text, force: true})
      if (etag) etag_entry.write({text: etag, force: true})

      return [dst, t]

    } finally {
      f.close()
    }
  }
  case 304:
    logger.replace(`cache: ${teal('hit')}`)
    return [dst, undefined]
  default:
    throw new Error(`${rsp.status}: ${src}`)
  }
}

async function download(opts: DownloadOptions): Promise<Path> {
  try {
    const [path] = await internal(opts)
    return path
  } catch (cause) {
    throw new TeaError('http', {cause, ...opts})
  }
}

async function stream<T>(opts: DownloadOptions, body: (src: ReadableStream<Uint8Array>) => Promise<T>): Promise<[Path, T]> {
  try {
    const [path, t] = await internal(opts, body)
    if (t) return [path, t]

    const f = await Deno.open(path.string, { read: true })
    try {
      const t = await body(f.readable)
      return [path, t]
    } finally {
      Deno.close(f.rid)
    }
  } catch (cause) {
    throw new TeaError('http', {cause, ...opts})
  }
}

function hash_key(url: URL): Path {
  function hash(url: URL) {
    const formatted = `${url.pathname}${url.search ? "?" + url.search : ""}`
    const contents = new TextEncoder().encode(formatted)
    return toHashString(crypto.subtle.digestSync("SHA-256", contents))
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
    stream,
    hash_key
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
