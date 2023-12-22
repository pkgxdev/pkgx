import { assertEquals, assertRejects, assertThrows } from "deno/assert/mod.ts"
import specimen, { _internals } from "./construct-env.ts"
import { Path, SemVer, semver, hooks } from "pkgx"
import * as mock from "deno/testing/mock.ts"

Deno.test("construct_env.ts", async runner => {
  const pkg1 = { project: 'foo', constraint: new semver.Range("^2")}
  const pkg2 = { project: 'bar', constraint: new semver.Range("~3.1")}

  await runner.step("std", async () => {
    const stub2 = mock.stub(_internals, "runtime_env", async () => ({
      FOO_FLAGS: "bar $FOO_FLAGS baz",
      PATH: "/opt/bin:$PATH",
      MANPATH: "/man",
      LIBRARY_PATH: "/lib",
    }))

    const tmp = Path.mktemp()

    const installations = [
      { pkg: {project: pkg1.project, version: new SemVer("2.3.4")}, path: tmp.join("foo/v2.3.4/bin").mkdir('p').parent() },
      { pkg: {project: pkg2.project, version: new SemVer("3.1.4")}, path: tmp.join("bar/v3.1.4/include").mkdir('p').parent() },
      { pkg: {project: "cmake.org", version: new SemVer("3.1.4")}, path: tmp.join("cmake.org/v3.1.4/lib").mkdir('p').parent() },
      { pkg: {project: "gnu.org/autoconf", version: new SemVer("4.5.6")}, path: tmp.join("gnu.org/autoconf/v4.5.6/share/aclocal").mkdir('p').parent().parent() },
    ]

    try {
      const rv = await specimen({ installations })
      assertEquals(rv['FOO_FLAGS'], "bar bar bar bar ${FOO_FLAGS} baz${FOO_FLAGS} baz${FOO_FLAGS} baz${FOO_FLAGS} baz") //FIXME lol
      assertEquals(rv['PATH'], `/opt/bin:${tmp.join('foo/v2.3.4/bin')}:\${PATH}`)
    } finally {
      stub2.restore()
      tmp.rm({recursive: true})
    }
  })

  await runner.step("coverage++", async () => {
    const pkg = { project: "bytereef.org/mpdecimal", version: new SemVer("2.1.2") }
    if (hooks.usePantry().missing()) {
      await assertRejects(async () => await _internals.runtime_env(pkg, []))
    } else {
      await _internals.runtime_env(pkg, [])
    }
  })
})
