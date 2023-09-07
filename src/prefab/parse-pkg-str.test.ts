// deno-lint-ignore-file no-explicit-any
import { ProvidesError, AmbiguityError } from "../utils/error.ts"
import { assertRejects, assertEquals } from "deno/assert/mod.ts"
import specimen, { _internals } from "./parse-pkg-str.ts"
import * as mock from "deno/testing/mock.ts"

Deno.test("parse-pkg-str.ts", async runner => {

  await runner.step("happy", async () => {
    const stub = mock.stub(_internals, "find", () => Promise.resolve([{ project: "foo.com" } as any]))
    try {
      const rv = await specimen("foo")
      assertEquals(rv.project, "foo.com")
      assertEquals(rv.constraint.toString(), "*")
    } finally {
      stub.restore()
    }
  })

  await runner.step("@latest", async () => {
    const stub = mock.stub(_internals, "find", () => Promise.resolve([{ project: "foo.com" } as any]))
    try {
      const rv = await specimen("foo@latest", { latest: 'ok' })
      assertEquals(rv.project, "foo.com")
      assertEquals(rv.constraint.toString(), "*")
      assertEquals(rv.update, true)
    } finally {
      stub.restore()
    }
  })

  await runner.step("ambiguous", async () => {
    const stub = mock.stub(_internals, "find", () => Promise.resolve([1, 2] as any))
    try {
      await assertRejects(() => specimen("foo"), AmbiguityError)
    } finally {
      stub.restore()
    }
  })

  await runner.step("no provides", async () => {
    const stub = mock.stub(_internals, "find", () => Promise.resolve([]))
    try {
      await assertRejects(() => specimen("foo"), ProvidesError)
    } finally {
      stub.restore()
    }
  })
})
