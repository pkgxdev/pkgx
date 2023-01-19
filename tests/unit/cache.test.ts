import { assert } from "deno/testing/asserts.ts"
import { useDownload } from "hooks"
import Path from "path"

Deno.test("etag-mtime-check",async () => {
  const tmpdir = new Path(await Deno.makeTempDir({ prefix: "tea" }))
  try {
    const src = new URL("https://dist.tea.xyz/ijg.org/versions.txt")

    await console.silence(async () => {
      await useDownload().download({src, dst: tmpdir.join("versions.txt")})

      const mtimePath = await useDownload().hash_key(src).join("mtime")
      const etagPath = await useDownload().hash_key(src).join("etag")

      const mtime = await mtimePath.read()
      const etag = await etagPath.read()

      const rsp = await fetch(src, {})
      const mtimeA = rsp.headers.get("Last-Modified")
      const etagA = rsp.headers.get("etag")

      assert(mtimeA === mtime)
      assert(etagA === etag)
      await rsp.body?.cancel()
    })
  } catch {
    tmpdir.rm({ recursive: true })
  }
})
