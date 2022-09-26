import { readerFromStreamReader, copy } from "deno/streams/conversion.ts"
import { useFlags, usePrefix } from "hooks"
import { flatmap } from "utils"
import { Sha256 } from "deno/hash/sha256.ts"
import { encode } from "deno/encoding/hex.ts"
import { crypto } from "deno/crypto/mod.ts"

import Path from "path"

const prefix = usePrefix().join("tea.xyz/var/www")

interface DownloadOptions {
  src: URL
  dst?: Path  /// default is our own unique cache path
  headers?: Record<string, string>
  ephemeral?: boolean  /// always download, do not rely on cache
}

async function download({ src, dst, headers, ephemeral }: DownloadOptions): Promise<Path> {
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

  const rsp = await fetch(src, {headers})

  switch (rsp.status) {
  case 200: {
    if ("If-Modified-Since" in (headers ?? {})) {
      console.info({downloading: src})
    }

    console.log("got status 200 while downloading")
    const rdr = rsp.body?.getReader()
    if (!rdr) throw new Error()
    const r = readerFromStreamReader(rdr)

    const local_SHA = await getlocalSHA(r)
    console.log({local_SHAFromEFfi: local_SHA})
    
    dst.parent().mkpath()
    const f = await Deno.open(dst.string, {create: true, write: true, truncate: true})
    try {
      await copy(r, f)
    } finally {
      f.close()
    }

    //TODO etags too
    flatmap(rsp.headers.get("Last-Modified"), text =>
      mtime_entry().write({ text, force: true }))

    return dst
  }
  case 304:
    console.log("got status 304 while downloading")
    console.log({dst})
    console.verbose("304: not modified")
    return dst
  default:
    console.log("got status default while downloading")

    if (numpty && dst.isFile()) {
      return dst
    } else {
      throw new Error(`${rsp.status}: ${src}`)
    }
  }
}

function _append(a: Uint8Array, b: Uint8Array, numOfByteRead: number) {
  // deno-lint-ignore no-var
  var c = new Uint8Array(a.length + numOfByteRead);
  c.set(a, 0);
  c.set(b.slice(0, numOfByteRead), a.length);
  return c;
}

function getlocalSHA(r: Deno.Reader) {
  
  let buf = new Uint8Array(1000);
  let chunk = new Uint8Array(0);
  
  r.read(buf).then(async function readByte(numOfByteRead) {
    if (numOfByteRead) {
      
      console.log({numOfByteRead})
      
      chunk = _append(chunk, buf, numOfByteRead);
      r.read(buf).then(readByte);
    } else {
        console.log("reached end of chunk")
        const local = crypto.subtle.digest("SHA-256", chunk)
          .then(buf => new TextDecoder().decode(encode(new Uint8Array(buf))))

        const [local_SHA] = await Promise.all([local])

        return local_SHA

    }
  });
}

function hash_key(url: URL): Path {
  function hash(url: URL) {
    const formatted = `${url.pathname}${url.search ? "?" + url.search : ""}`
    return new Sha256().update(formatted).toString()
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
