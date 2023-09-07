import { assertEquals } from "deno/assert/mod.ts"
import shEscape from "./sh-escape.ts"

Deno.test("shEscape", () => {
  assertEquals(shEscape("foo"), "foo")
  assertEquals(shEscape("foo bar"), '"foo bar"')
  assertEquals(shEscape("foo'bar"), '"foo\'bar"')
  assertEquals(shEscape('foo"bar'), "'foo\"bar'")
  assertEquals(shEscape('foo\'bar"baz'), '"foo\'bar\\"baz"')
  assertEquals(shEscape("foo\nbar"), '"foo\nbar"')
});
