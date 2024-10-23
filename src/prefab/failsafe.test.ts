// deno-lint-ignore-file require-await
import { assertEquals } from "@std/assert"
import specimen, { _internals } from "./failsafe.ts"
import { assertRejects } from "@std/assert"
import * as mock from "@std/testing/mock"
import { PackageNotFoundError } from "pkgx"

Deno.test("failsafe.ts", async runner => {
  const stub = mock.stub(_internals, "useSync", () => Promise.resolve())

  try {
    await runner.step("retries", async () => {
      let i = 0
      const rv = await specimen(async () => {
        if (i++ === 0) {
          throw new PackageNotFoundError("foo.com")
        } else {
          return "ok"
        }
      })
      assertEquals(rv, "ok")
    })

    await runner.step("throws", async () => {
      let i = 0
      await assertRejects(() => specimen(async () => {
        throw new Error()
      }))
    })

  } finally {
    stub.restore()
  }
})
