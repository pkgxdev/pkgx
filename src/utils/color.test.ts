import { assertEquals } from "deno/assert/mod.ts";
import { blurple, dim, inverse_blurple } from "./color.ts";

Deno.test("color", async runner => {

  await runner.step("blurple", () => {
    assertEquals(blurple("Hello"), "\x1b[38;5;63mHello\x1b[39m")
  })

  await runner.step("dim", () => {
    const input = "Hello";
    const expected = "\x1b[2mHello\x1b[22m";

    assertEquals(dim(input), expected);
  })

  await runner.step("inverse_blurple", () => {
    assertEquals(inverse_blurple("Hello"), "\x1b[48;5;63mHello\x1b[49m");
  })
})
