import { assert } from "deno/testing/asserts.ts"
import { createTestHarness } from "./testUtils.ts"
import { SemVer } from "tea"

Deno.test("update package", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const {run, TEA_PREFIX } = await createTestHarness()

  await run(["+sqlite.org=3.39.4"])

  const expected = TEA_PREFIX.join("sqlite.org").join("v3.39.4")
  assert(expected.exists(), "sqlite.org should exist")

  await run(["-S", "+sqlite.org"])

  const newVersionLink = TEA_PREFIX.join("sqlite.org").join("v*")
  assert(newVersionLink.isSymlink())
  const newVersion = newVersionLink.readlink().basename()

  assert(new SemVer(newVersion).gt(new SemVer("3.39.4")))
})

Deno.test("sync and update without git on path", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const {run, TEA_PREFIX } = await createTestHarness({sync: false})

  // empty path so tea can't find git
  await run(["-S", "+zlib.net"], { env: { PATH: "", obj: {} }})

  const expected = TEA_PREFIX.join("zlib.net")
  assert(expected.exists(), "zlib.net should exist")

  // allows us to verify that the subsequent update works
  TEA_PREFIX.join("tea.xyz/var/pantry/projects/zlib.net").rm({ recursive: true })

  await run(["-S", "+zlib.net"], { env: { PATH: "", obj: {} }})
})

Deno.test("sync without git then update with git", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const {run, TEA_PREFIX } = await createTestHarness({sync: false})

  // empty path so tea can't find git
  await run(["-S", "+zlib.net"], { env: { PATH: "", obj: {} }})

  const expected = TEA_PREFIX.join("zlib.net")
  assert(expected.exists(), "zlib.net should exist")

  // allows us to verify that the subsequent update works
  TEA_PREFIX.join("tea.xyz/var/pantry/projects/zlib.net").rm({ recursive: true })

  await run(["-S", "+zlib.net"])
})

Deno.test("sync with git then update without", { sanitizeResources: false, sanitizeOps: false }, async () => {
  const {run, TEA_PREFIX } = await createTestHarness({sync: false})

  await run(["-S", "--json", "+zlib.net"])

  const expected = TEA_PREFIX.join("zlib.net")
  assert(expected.exists(), "zlib.net should exist")

  // allows us to verify that the subsequent update works
  TEA_PREFIX.join("tea.xyz/var/pantry/projects/zlib.net").rm({ recursive: true })

  await run(["-S", "+zlib.net"], { env: { PATH: "", obj: {} }})
})
