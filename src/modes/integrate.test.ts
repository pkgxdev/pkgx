// deno-lint-ignore-file no-explicit-any
import { afterEach, beforeEach, describe, afterAll, it } from "deno/testing/bdd.ts"
import specimen0, { _internals } from "./integrate.ts"
import { assertRejects } from "deno/assert/mod.ts"
import * as mock from "deno/testing/mock.ts"
import { isString } from "is-what"
import { Path } from "pkgx"

describe("integrate.ts", () => {
  let file: Path
  let stub1: mock.Stub<typeof _internals>

  const specimen = async (op: any) => {
    await specimen0(op, {dryrun: false})
    await specimen0(op, {dryrun: true})
  }

  const stub2 = mock.stub(_internals, "stderr", () => {})
  const stub3 = mock.stub(_internals, "stdout", x => isString(x))

  beforeEach(() => {
    file = Path.mktemp().join(".bash_profile")
    stub1 = mock.stub(_internals, "home", () => file.parent())
  })

  afterEach(() => {
    file.parent().rm({recursive: true})
    stub1.restore()
  })

  afterAll(() => {
    stub2.restore()
    stub3.restore()
  })

  it("empty", async function() {
    file.touch()

    await specimen("install")
    await specimen("install")
    await specimen("uninstall")
    await specimen("uninstall")
  });

  it("not empty", async function() {
    file.write({text: "# hi\n"})

    await specimen("install")
    await specimen("uninstall")
  })

  describe("just newlines", function() {
    for (let i = 1; i < 5; ++i) {
      it (`${i} newlines`, async function() {
        file.write({text: "\n"})

        await specimen("install")
        await specimen("uninstall")
      })
    }
  })

  it("no files", {
    ignore: Deno.build.os != "darwin",  // runs on darwin
  }, async function() {
    file.rm()
    await specimen("install")
    await specimen("uninstall")
  })

  it("no files", {
    ignore: Deno.build.os == "darwin",  // runs on linux
  }, async () => {
    await assertRejects(() => specimen("install"))
  })

  it("isatty", async function() {
    const stub = mock.stub(_internals, "isatty", () => true)
    try {
      file.touch()
      await specimen("install")
    } finally {
      stub.restore()
    }
  })
})
