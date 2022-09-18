import { readerFromStreamReader, copy } from "deno/streams/conversion.ts"
import { createHash } from "deno/hash/mod.ts"
import { Path } from "types"
import { flatMap } from "utils"
import useCellar from "hooks/useCellar.ts"
import useFlags from "hooks/useFlags.ts"

const prefix = useCellar().prefix.join("tea.xyz/var/www")

interface DownloadOptions {
  src: URL
  dst?: Path  /// default is our own unique cache path
  headers?: Record<string, string>
  force?: boolean  /// always download, do not send if-modified-since
}

async function download({ src, dst, headers, force }: DownloadOptions): Promise<Path> {
  console.verbose({src: src, dst})

  const { numpty } = useFlags()
  dst ??= hash_key(src).join(src.path().basename())
  if (src.protocol === "file:") throw new Error()

  const mtime_entry = hash_key(src).join("mtime")
  if (!force && mtime_entry.isFile() && dst.isReadableFile()) {
    headers ??= {}
    headers["If-Modified-Since"] = await mtime_entry.read()
    console.info({querying: src.toString()})
  } else {
    console.info({downloading: src.toString()})
  }

  const rsp = await fetch(src, {headers})

  switch (rsp.status) {
  case 200: {
    if ("If-Modified-Since" in (headers ?? {})) {
      console.info({downloading: src})
    }
    const rdr = rsp.body?.getReader()
    if (!rdr) throw new Error()
    const r = readerFromStreamReader(rdr)
    const f = await Deno.open(dst.string, {create: true, write: true, truncate: true})
    try {
      await copy(r, f)
    } finally {
      f.close()
    }

    //TODO etags too
    flatMap(rsp.headers.get("Last-Modified"), text =>
      mtime_entry.write({ text, force: true }))

    return dst
  }
  case 304:
    console.verbose("304: not modified")
    return dst
  default:
    if (numpty && dst.isFile()) {
      return dst
    } else {
      throw new Error(`${rsp.status}: ${src}`)
    }
  }
}

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

export default function useDownload() {
  return { download, prefix, hash_key }
}
