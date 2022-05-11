import { assert } from "deno/testing/asserts.ts"

Deno.test("usage", async () => {
  const out = await shout({ tea: ["--help"] })
  assert(out.split("\n").length > 0)
})

async function shout({ tea: args }: { tea: string[] }) {
  const srcroot = Deno.env.get("SRCROOT")
  const cmd = [
    'deno',
    'run',
    '--allow-env',
    `--import-map=${srcroot}/import-map.json`,
    `${srcroot}/src/app.ts`,
    ...args
  ]

  const proc = Deno.run({ cmd, stdout: "piped" })
  const raw = await proc.output()
  proc.close()

  return new TextDecoder().decode(raw)
}