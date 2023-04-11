import { assert, assertEquals } from "deno/testing/asserts.ts"
import { useDb } from "hooks"
import Path from "path"
import { Provider } from "hooks/useDarkMagic.ts"
import { DarkMagicChoice } from "hooks/useDb.ts"

Deno.test("create db", async () => {
  const tmpDb = new Path(await Deno.makeTempDir({ prefix: "tea-" })).realpath().join("db.sqlite3")
  const db = new useDb(tmpDb)

  assert(tmpDb.exists())
  db.close()
})

Deno.test("get/set DarkMagicChoice", async () => {
  const tmpDb = new Path(await Deno.makeTempDir({ prefix: "tea-" })).realpath().join("db.sqlite3")
  const db = new useDb(tmpDb)

  const a = db.findDarkMagicChoice("a")
  assertEquals(a, undefined)

  const b = new DarkMagicChoice()
  b.bin = "foobar"
  b.provider = Provider.npm

  const c = db.setDarkMagicChoice("foobar", Provider.npm)
  assertEquals(c.bin, b.bin)
  assertEquals(c.provider, b.provider)
  assert(c.id > 0)

  const d = db.findDarkMagicChoice("foobar")
  assertEquals(d, c)

  db.close()
})
