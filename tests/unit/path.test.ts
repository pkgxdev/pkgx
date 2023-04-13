import Path from "path";
import { assert, assertEquals, assertFalse, assertThrows } from "deno/testing/asserts.ts"

Deno.test("test Path", async test => {
  await test.step("creating files", () => {
    assertEquals(new Path("/a/b/c").components(), ["", "a", "b", "c"])
    assertEquals(new Path("/a/b/c").split(), [new Path("/a/b"), "c"])

    const tmp = Path.mktemp({prefix: "tea-"})
    assert(tmp.isEmpty())

    const child = tmp.join("a/b/c")
    assertFalse(child.parent().isDirectory())
    child.parent().mkpath()
    assert(child.parent().isDirectory())

    assertThrows(() => child.readlink()) // not found
    assertFalse(child.isReadableFile())
    child.touch()
    assert(child.isReadableFile())

    assert(child.in(tmp))
    assertFalse(tmp.isEmpty())
    assertEquals(child.readlink(), child) // not a link
  })

  await test.step("write and read", async () => {
    const tmp = Path.mktemp({prefix: "tea-"})

    const data = tmp.join("test.dat")
    data.write({text: "hello\nworld"})

    const lines = await asyncIterToArray(data.readLines())
    assertEquals(lines, ["hello", "world"])

    // will throw with no force flag
    assertThrows(() => data.write({ json: { hello: "world" } }))

    data.write({ json: { hello: "world" }, force: true })
    assertEquals(await data.readJSON(), { hello: "world" })
  })

  await test.step("test walk", async () => {
    const tmp = Path.mktemp({prefix: "tea-"})

    const a = tmp.join("a").mkdir()
    a.join("a1").touch()
    a.join("a2").touch()

    const b = tmp.join("b").mkdir()
    b.join("b1").touch()
    b.join("b2").touch()

    const c = tmp.join("c").mkdir()
    c.join("c1").touch()
    c.join("c2").touch()

    const walked = (await asyncIterToArray(tmp.walk()))
      .map(([path, entry]) => {
        return {name: path.basename(), isDir: entry.isDirectory}
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    assertEquals(walked, [
      { name: "a", isDir: true},
      { name: "a1", isDir: false},
      { name: "a2", isDir: false},
      { name: "b", isDir: true},
      { name: "b1", isDir: false},
      { name: "b2", isDir: false},
      { name: "c", isDir: true},
      { name: "c1", isDir: false},
      { name: "c2", isDir: false},
    ])
  })
})

async function asyncIterToArray<T> (iter: AsyncIterable<T>){
  const result = [];
  for await(const i of iter) {
    result.push(i);
  }
  return result;
}
