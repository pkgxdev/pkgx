// deno-lint-ignore-file no-explicit-any
import { assertRejects, assertEquals } from "deno/assert/mod.ts"
import specimen, { _internals } from "./resolve-arg0.ts"
import { AmbiguityError } from "../utils/error.ts"
import { faker_args } from "../utils/test-utils.ts"
import * as mock from "deno/testing/mock.ts"
import { Path, semver, SemVer } from "pkgx"

Deno.test("resolve-arg0.ts", async runner => {
  await runner.step("ambiguous but only one installed", async () => {
    //TODO really we should stub usePantry to return multiple pkgs with a provides set

    const pkg1 = { project: "foo.com", constraint: new semver.Range("^2") }
    const pkg2 = { project: "bar.com", constraint: new semver.Range("^3") }
    const args = faker_args()
    const version = new SemVer("2.3.4")

    const stub1 = mock.stub(_internals, "which", () => Promise.resolve([{...pkg1, shebang: args.slice(0, 1) }, {...pkg2, shebang: [""] }]))
    // deno-lint-ignore require-await
    const stub2 = mock.stub(_internals, "has", async pkg => {
      if ((pkg as any).project == pkg1.project) {
        return {pkg: { project: pkg1.project, version }, path: new Path("/opt/foo")}
      }
    })

    try {
      const rv = await specimen(args[0], [])
      assertEquals(rv!.project, pkg1.project)
    } finally {
      stub1.restore()
      stub2.restore()
    }
  })

  await runner.step("ambiguous but dry powder contains one", async () => {
    const pkg1 = { project: "foo.com", constraint: new semver.Range("^2") }
    const pkg2 = { project: "bar.com", constraint: new semver.Range("^3") }
    const args = faker_args()

    const stub = mock.stub(_internals, "which", () => Promise.resolve([{...pkg1, shebang: args.slice(0, 1) }, {...pkg2, shebang: [""] }]))

    try {
      const rv = await specimen(args[0], [pkg1])
      assertEquals(rv!.project, pkg1.project)
    } finally {
      stub.restore()
    }
  })

  await runner.step("ambiguous and dry powder contains both", async () => {
    const pkg1 = { project: "foo.com", constraint: new semver.Range("^2") }
    const pkg2 = { project: "bar.com", constraint: new semver.Range("^3") }
    const args = faker_args()

    const stub = mock.stub(_internals, "which", () => Promise.resolve([{...pkg1, shebang: args.slice(0, 1) }, {...pkg2, shebang: [""] }]))

    try {
      await assertRejects(() => specimen(args[0], [pkg1, pkg2]), AmbiguityError)
    } finally {
      stub.restore()
    }
  })

  await runner.step("AmbiguityError", async () => {
    //TODO really we should stub usePantry to return multiple pkgs with a provides set

    const pkg1 = { project: "foo.com", constraint: new semver.Range("^2") }
    const pkg2 = { project: "bar.com", constraint: new semver.Range("^3") }

    const stub1 = mock.stub(_internals, "which", () => Promise.resolve([{...pkg1, shebang: [""] }, {...pkg2, shebang: [""] }]))

    try {
      const args = faker_args()
      await assertRejects(() => specimen(args[0], []), AmbiguityError)
    } finally {
      stub1.restore()
    }
  })
})
