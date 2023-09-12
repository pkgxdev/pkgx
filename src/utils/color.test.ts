import { assertEquals } from "deno/assert/mod.ts";
import { teal, dim, inverse_teal } from "./color.ts";

Deno.test("color", async runner => {

  await runner.step("teal", () => {
    assertEquals(teal("Hello"), "\x1b[38;5;86mHello\x1b[39m")
  })

  await runner.step("dim", () => {
    const input = "Hello";
    const expected = "\x1b[2mHello\x1b[22m";

    assertEquals(dim(input), expected);
  })

  await runner.step("inverse_teal", () => {
    assertEquals(inverse_teal("Hello"), "\x1b[48;5;86mHello\x1b[49m");
  })
})
