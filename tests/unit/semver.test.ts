import { assert, assertEquals, assertFalse, assertThrows } from "deno/testing/asserts.ts"
import SemVer, * as semver from "utils/semver.ts"


Deno.test("semver", async test => {
  await test.step("sort", () => {
    const input = [new SemVer([1,2,3]), new SemVer("2.3.4"), new SemVer("1.2.4")]
    const sorted1 = input.sort(semver.compare)
    const sorted2 = input.sort()

    assertEquals(sorted1.join(","), "1.2.3,1.2.4,2.3.4")
    assertEquals(sorted2.join(","), "1.2.3,1.2.4,2.3.4")
  })

  await test.step("parse", () => {
    assertEquals(semver.parse("1.2.3")?.toString(), "1.2.3")
    assertEquals(semver.parse("1.2")?.toString(), "1.2.0")
    assertEquals(semver.parse("1")?.toString(), "1.0.0")
  })

  await test.step("constructor", () => {
    assertEquals(new SemVer("1.2.3").toString(), "1.2.3")
    assertEquals(new SemVer("v1.2.3").toString(), "1.2.3")
    assertThrows(() => new SemVer("1.2"))
    assertThrows(() => new SemVer("v1.2"))
  })

  await test.step("ranges", () => {
    const a = new semver.Range(">=1.2.3<2.3.4 || >=3")
    assertEquals(a.toString(), ">=1.2.3<2.3.4,>=3")

    assert(a.satisfies(new SemVer("1.2.3")))
    assert(a.satisfies(new SemVer("1.4.1")))
    assert(a.satisfies(new SemVer("3.0.0")))
    assert(a.satisfies(new SemVer("90.0.0")))
    assertFalse(a.satisfies(new SemVer("2.3.4")))
    assertFalse(a.satisfies(new SemVer("2.5.0")))

    const b = new semver.Range("^0.15")
    assertEquals(b.toString(), "^0.15")

    const c = new semver.Range("~0.15")
    assertEquals(c.toString(), "~0.15")

    assert(c.satisfies(new SemVer("0.15.0")))
    assert(c.satisfies(new SemVer("0.15.1")))
    assertFalse(c.satisfies(new SemVer("0.14.0")))
    assertFalse(c.satisfies(new SemVer("0.16.0")))

    const d = new semver.Range("~0.15.1")
    assertEquals(d.toString(), "~0.15.1")
    assert(d.satisfies(new SemVer("0.15.1")))
    assert(d.satisfies(new SemVer("0.15.2")))
    assertFalse(d.satisfies(new SemVer("0.15.0")))
    assertFalse(d.satisfies(new SemVer("0.16.0")))
    assertFalse(d.satisfies(new SemVer("0.14.0")))

    const e = new semver.Range("~1")
    assertEquals(e.toString(), "^1")  // indeed: we change the ~ to ^

    const f = new semver.Range("^14||^16||^18")
    assert(f.satisfies(new SemVer("14.0.0")))
    assertFalse(f.satisfies(new SemVer("15.0.0")))
    assert(f.satisfies(new SemVer("16.0.0")))
    assertFalse(f.satisfies(new SemVer("17.0.0")))
    assert(f.satisfies(new SemVer("18.0.0")))
  })

  await test.step("intersection", async test => {
    await test.step("^3.7…@3.11", () => {
      const a = new semver.Range("^3.7")
      const b = new semver.Range("3.11.0")

      assertEquals(b.toString(), "@3.11.0")

      const c = semver.intersect(a, b)
      assertEquals(c.toString(), "@3.11.0")
    })

    await test.step("^3.7…^3.9", () => {
      const a = new semver.Range("^3.7")
      const b = new semver.Range("^3.9")

      assertEquals(b.toString(), "^3.9")

      const c = semver.intersect(a, b)
      assertEquals(c.toString(), "^3.9")
    })

    await test.step("^3.7…*", () => {
      const a = new semver.Range("^3.7")
      const b = new semver.Range("*")

      assertEquals(b.toString(), "*")

      const c = semver.intersect(a, b)
      assertEquals(c.toString(), "^3.7")
    })

    await test.step("~3.7…~3.8", () => {
      const a = new semver.Range("~3.7")
      const b = new semver.Range("~3.8")

      assertThrows(() => semver.intersect(a, b))
    })
  })
})
