import { assertEquals } from "deno/testing/asserts.ts"
import suite from "../integration.suite.ts"
import { it } from "deno/testing/bdd.ts"
import undent from "outdent"
import { Path } from "tea"

it(suite, "runtime.env tildes", async function() {
  const run = async (FOO: string) => {
    this.sandbox.join("projects/tea.xyz/foo").mkdir('p').join("package.yml").write({ text: undent`
      provides: [bin/foo]
      runtime:
        env:
          FOO: "${FOO}"
      `, force: true})

    this.sandbox.join("tea.xyz/foo/v1.0.0/bin").mkdir('p').join("foo").write({ text: undent`
      #!/bin/sh
      echo "$FOO"
      `, force: true}).chmod(0o755)

    const out = await this.run({
      args: ["foo"],
      env: {
        TEA_PANTRY_PATH: this.sandbox.string,
        TEA_PREFIX: this.sandbox.string
      },
    }).stdout()

    assertEquals(out.trim(), FOO.replaceAll("{{home}}", Path.home().string))
  }

  await run("{{home}}/foo")
})
