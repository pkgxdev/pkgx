import { assert, assertEquals, assertFalse, assertThrows } from "deno/testing/asserts.ts"
import SemVer, * as semver from "utils/semver.ts"


Deno.test("semver", async test => {
  await test.step("sort", () => {
    const input = [new SemVer([1,2,3]), new SemVer("2.3.4"), new SemVer("1.2.4"), semver.parse("1.2.3.1")!]
    const sorted1 = input.sort(semver.compare)
    const sorted2 = input.sort()

    assertEquals(sorted1.join(","), "1.2.3,1.2.3.1,1.2.4,2.3.4")
    assertEquals(sorted2.join(","), "1.2.3,1.2.3.1,1.2.4,2.3.4")
  })

  await test.step("parse", () => {
    assertEquals(semver.parse("1.2.3.4.5")?.toString(), "1.2.3.4.5")
    assertEquals(semver.parse("1.2.3.4")?.toString(), "1.2.3.4")
    assertEquals(semver.parse("1.2.3")?.toString(), "1.2.3")
    assertEquals(semver.parse("1.2")?.toString(), "1.2.0")
    assertEquals(semver.parse("1")?.toString(), "1.0.0")
  })

  await test.step("satisfies", () => {
    assertEquals(new semver.Range("=3.1.0").max([new SemVer("3.1.0")]), new SemVer("3.1.0"))
  })

  await test.step("constructor", () => {
    assertEquals(new SemVer("1.2.3.4.5.6").toString(), "1.2.3.4.5.6")
    assertEquals(new SemVer("1.2.3.4.5").toString(), "1.2.3.4.5")
    assertEquals(new SemVer("1.2.3.4").toString(), "1.2.3.4")
    assertEquals(new SemVer("1.2.3").toString(), "1.2.3")
    assertEquals(new SemVer("v1.2.3").toString(), "1.2.3")
    assertEquals(new SemVer("1.2").toString(), "1.2.0")
    assertEquals(new SemVer("v1.2").toString(), "1.2.0")
    assertEquals(new SemVer("1").toString(), "1.0.0")
    assertEquals(new SemVer("v1").toString(), "1.0.0")

    assertEquals(new SemVer("9e").toString(), "9e")
    assertEquals(new SemVer("9e").components, [9,5])
    assertEquals(new SemVer("3.3a").toString(), "3.3a")
    assertEquals(new SemVer("3.3a").components, [3,3,1])
    assertEquals(new SemVer("1.1.1q").toString(), "1.1.1q")
    assertEquals(new SemVer("1.1.1q").components, [1,1,1,17])
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
    // Due to the nature of the `^` operator, this
    // is the same as `~0.15`, and our code represents
    // it as such.
    assertEquals(b.toString(), "~0.15")

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

    // `~` is weird
    const e = new semver.Range("~1")
    assertEquals(e.toString(), "^1")
    assert(e.satisfies(new SemVer("v1.0")))
    assert(e.satisfies(new SemVer("v1.1")))
    assertFalse(e.satisfies(new SemVer("v2")))

    const f = new semver.Range("^14||^16||^18")
    assert(f.satisfies(new SemVer("14.0.0")))
    assertFalse(f.satisfies(new SemVer("15.0.0")))
    assert(f.satisfies(new SemVer("16.0.0")))
    assertFalse(f.satisfies(new SemVer("17.0.0")))
    assert(f.satisfies(new SemVer("18.0.0")))

    const g = new semver.Range("<15")
    assert(g.satisfies(new SemVer("14.0.0")))
    assert(g.satisfies(new SemVer("0.0.1")))
    assertFalse(g.satisfies(new SemVer("15.0.0")))

    const i = new semver.Range("^1.2.3.4")
    assert(i.satisfies(new SemVer("1.2.3.4")))
    assert(i.satisfies(new SemVer("1.2.3.5")))
    assert(i.satisfies(new SemVer("1.2.4.2")))
    assert(i.satisfies(new SemVer("1.3.4.2")))
    assertFalse(i.satisfies(new SemVer("2.0.0")))

    const j = new semver.Range("^0.1.2.3")
    assert(j.satisfies(new SemVer("0.1.2.3")))
    assert(j.satisfies(new SemVer("0.1.3")))
    assertFalse(j.satisfies(new SemVer("0.2.0")))

    const k = new semver.Range("^0.0.1.2")
    assertFalse(k.satisfies(new SemVer("0.0.1.1")))
    assert(k.satisfies(new SemVer("0.0.1.2")))
    assert(k.satisfies(new SemVer("0.0.1.9")))
    assertFalse(k.satisfies(new SemVer("0.0.2.0")))

    const l = new semver.Range("^0.0.0.1")
    assertFalse(l.satisfies(new SemVer("0.0.0.0")))
    assert(l.satisfies(new SemVer("0.0.0.1")))
    assertFalse(l.satisfies(new SemVer("0.0.0.2")))

    // This one is weird, but it should mean "<1"
    const m = new semver.Range("^0")
    assert(m.satisfies(new SemVer("0.0.0")))
    assert(m.satisfies(new SemVer("0.0.1")))
    assert(m.satisfies(new SemVer("0.1.0")))
    assert(m.satisfies(new SemVer("0.9.1")))
    assertFalse(m.satisfies(new SemVer("1.0.0")))

    assertThrows(() => new semver.Range("1"))
    assertThrows(() => new semver.Range("1.2"))
    assertThrows(() => new semver.Range("1.2.3"))
    assertThrows(() => new semver.Range("1.2.3.4"))
  })

  await test.step("intersection", async test => {
    await test.step("^3.7…=3.11", () => {
      const a = new semver.Range("^3.7")
      const b = new semver.Range("=3.11")

      assertEquals(b.toString(), "=3.11.0")

      const c = semver.intersect(a, b)
      assertEquals(c.toString(), "=3.11.0")
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

    await test.step("^3.7…=3.8", () => {
      const a = new semver.Range("^3.7")
      const b = new semver.Range("=3.8")
      const c = semver.intersect(a, b)
      assertEquals(c.toString(), "=3.8.0")
    })

    await test.step("^11,^12…^11.3", () => {
      const a = new semver.Range("^11,^12")
      const b = new semver.Range("^11.3")
      const c = semver.intersect(a, b)
      assertEquals(c.toString(), "^11.3")
    })

    await test.step(">=11<12", () => {
      const a = new semver.Range(">=11<12")
      const b = new semver.Range(">=11.0.0 <13.0.0.0")
      //assertEquals(a.toString(), "^11.3")
      assert(a.satisfies(new SemVer("11.0.0")))
      assert(a.satisfies(new SemVer("11.9.0")))
      assert(b.satisfies(new SemVer("11.0.0")))
      assert(b.satisfies(new SemVer("11.9.0")))
      assert(b.satisfies(new SemVer("12.9.0")))
    })

    await test.step(">=0.47<1", () => {
      const a = new semver.Range(">=0.47<1")
      assertEquals(a.toString(), ">=0.47<1")
      assert(a.satisfies(new SemVer("0.47.0")))
      assert(a.satisfies(new SemVer("0.47.9")))
      assert(a.satisfies(new SemVer("0.48.0")))
      assert(a.satisfies(new SemVer("0.80.0")))
      assertFalse(a.satisfies(new SemVer("1.0.0")))
    })

    //FIXME this *should* work
    // await test.step("^11,^12…^11.3,^12.2", () => {
    //   const a = new semver.Range("^11,^12")
    //   const b = new semver.Range("^11.3")
    //   const c = semver.intersect(a, b)
    //   assertEquals(c.toString(), "^11.3,^12.2")
    // })
  })
})
