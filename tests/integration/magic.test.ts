import { assertEquals } from "deno/testing/asserts.ts"
import suite from "../integration.suite.ts"
import { it } from "deno/testing/bdd.ts"
import { undent } from "utils"

it(suite, "tea --magic in a script. zsh", async function() {
  const script = this.sandbox.join("magic.zsh").write({ text: undent`
    #!/bin/zsh

    set -e

    test $(basename $(ps -hp $$ | awk '{print $4}' | tail -n1)) = zsh

    source <(tea --magic=zsh)

    node --eval 'console.log(1)'
    `}).chmod(0o700)

  const code = await this.run({ cmd: [script.string] })

  assertEquals(code, 0)
})

it(suite, "tea --magic in a script. bash", async function() {
  const script = this.sandbox.join("magic.bash").write({ text: undent`
    #!/bin/bash

    set -e

    test $(basename $(ps -hp $$ | awk '{print $4}' | tail -n1)) = bash

    source <(tea --magic=bash)

    node --eval 'console.log(1)'
    `})

  const code = await this.run({ args: [script.string] })

  assertEquals(code, 0)
})

it(suite, "tea --magic in a script. fish", async function() {
  const script = this.sandbox.join("magic.fish").write({ text: undent`
    #!/bin/fish

    test $(basename $(ps -hp $fish_pid | awk '{print $4}' | tail -n1)) = fish

    tea --magic=fish | source

    node --eval 'console.log(1)'
    `})

  const code = await this.run({ args: [script.string] })

  assertEquals(code, 0)
})
