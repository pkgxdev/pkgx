import { crypto, toHashString } from "deno/crypto/mod.ts"
import { Logger, teal, gray } from "./useLogger.ts"
import { chuzzle, error, TeaError } from "utils"
import { useFlags, usePrefix, useFetch } from "hooks"
import { isString } from "is_what"
import Path from "path"

interface DownloadOptions {
  src: URL
  headers?: Record<string, string>
  logger?: Logger | string
  dst?: Path
}

interface RV {
  path: Path

  // we only give you the sha if we download
  // if we found the cache then you have to calculate the sha yourself
  sha: string | undefined
}

async function internal<T>({ src, headers, logger, dst }: DownloadOptions): Promise<[Path, ReadableStream<Uint8Array> | undefined]>
{
  logger = isString(logger) ? new Logger(logger) : logger ?? new Logger()

  const hash = hash_key(src)
  const mtime_entry = hash.join("mtime")
  const etag_entry = hash.join("etag")

  dst ??= hash.join(src.path().basename())
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

  const rsp = await useFetch(src, { headers })

  switch (rsp.status) {
  case 200: {
    const sz = chuzzle(parseInt(rsp.headers.get("Content-Length")!))

    let txt = teal('downloading')
    if (sz) txt += ` ${gray(pretty_size(sz))}`
    logger.replace(txt)

    const reader = rsp.body ?? error.panic()

    const text = rsp.headers.get("Last-Modified")
    if (text) mtime_entry.write({text, force: true})
    const etag = rsp.headers.get("ETag")
    if (etag) etag_entry.write({text: etag, force: true})

    if (Deno.env.get('CI') || useFlags().silent) {
      return [dst, reader]
    } else {
      let n = 0
      return [dst, reader.pipeThrough(new TransformStream({
        transform: (buf, controller) => {
          let s = txt
          if (!sz) {
            s += ` ${pretty_size(n)}`
          } else {
            n += buf.length
            if (n < sz) {
              let pc = n / sz * 100;
              pc = pc < 1 ? Math.round(pc) : Math.floor(pc);  // don’t say 100% at 99.5%
              s += ` ${pc}%`
            } else {
              s = teal('extracting')
            }
          }
          (logger as Logger).replace(s)
          controller.enqueue(buf)
      }}))]
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
    const [path, stream] = await internal(opts)
    if (!stream) return path  // already downloaded

    path.parent().mkpath()
    const f = await Deno.open(path.string, {create: true, write: true, truncate: true})
    await stream.pipeTo(f.writable)
    return path
  } catch (cause) {
    throw new TeaError('http', {cause, ...opts})
  }
}

async function stream<T>(opts: DownloadOptions): Promise<ReadableStream<Uint8Array> | undefined> {
  try {
    const [, stream] = await internal(opts)
    return stream
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
