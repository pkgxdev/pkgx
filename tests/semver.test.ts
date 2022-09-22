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
  })
})
