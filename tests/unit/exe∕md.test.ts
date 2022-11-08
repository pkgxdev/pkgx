import { assert, assertEquals } from "deno/testing/asserts.ts"
import { useExecutableMarkdown } from "hooks"
import { undent } from "utils"
import { shout, sandbox } from "../utils.ts"

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
  const { markdown } = fixture()
  const output = await sandbox(async tmpdir => {
    tmpdir.join(".git").mkdir()
    tmpdir.join("README.md").write({ text: undent`
      # Build
      ${markdown}

      # Metadata
      | Key     | Value   |
      |---------|---------|
      | Version | 1.2.3   |
      `})
    //FIXME metadata table because depending on tea.xyz is silently ignored
    return await shout({ tea: ["build"], cwd: tmpdir })
  })
  assertEquals(output, "foo bar\n")
})


////////////////////////////////////////////////////////////////////////// util
function fixture() {
  const script = 'echo foo bar'
  const markdown = undent`
    \`\`\`sh
    ${script}
    \`\`\`
    `
  return { script, markdown }
}
