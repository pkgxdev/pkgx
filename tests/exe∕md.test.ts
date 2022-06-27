import { assert } from "deno/testing/asserts.ts"
import useExecutableMarkdown from "hooks/useExecutableMarkdown.ts"
import { undent } from "utils"
import { shout, sandbox } from "./utils.ts"

////////////////////////////////////////////////////////////////////////// unit
Deno.test("find-script-simple", async () => {
  const {script, markdown } = fixture()
  const text = undent`
    # Title
    ## Build
    ${markdown}
    `

  const output = await useExecutableMarkdown({ text })
    .findScript("build")

  assert(output === script)
})

Deno.test("find-script-complex", async () => {
  const {markdown: dummy} = fixture()
  const {markdown, script} = fixture()
  const text = undent`
    # Title

    Lorem ipsum.
    Lorem ipsum.

    ## Build

    Lorem ipsum.
    Lorem ipsum.

    ${dummy}

    ## Deploy

    Lorem ipsum.

    ${markdown}

    Lorem ipsum.

    # Foo

    Bar.
    `

  const output = await useExecutableMarkdown({ text })
    .findScript("deploy")

  assert(output === script)
})

////////////////////////////////////////////////////////////////////////// impl
Deno.test("tea build", async () => {
  const { markdown, script } = fixture()
  const output = await sandbox(async tmpdir => {
    tmpdir.join("README.md").write({ text: undent`
      # Build
      ${markdown}
      `})
    return await shout({ tea: ["build"], cwd: tmpdir })
  })
  assert(output == script)
})


////////////////////////////////////////////////////////////////////////// util
function fixture() {
  const script = 'foo bar'
  const markdown = undent`
    \`\`\`sh
    ${script}
    \`\`\`
    `
  return { script, markdown }
}
