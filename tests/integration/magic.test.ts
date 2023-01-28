import { assert, assertEquals } from "deno/testing/asserts.ts"
import { strip_ansi_escapes } from "hooks/useLogger.ts"
import suite from "../integration.suite.ts"
import { it } from "deno/testing/bdd.ts"
import { undent } from "utils"

it(suite, "tea --magic in a script. zsh", async function() {
  const script = this.sandbox.join("magic-zsh").write({ text: undent`
    #!/bin/zsh

    set -e

    #TODO pkg \`ps\` so this is consistent
    if test $(uname) = Linux; then
      N=5
    else
      N=4
    fi

    test $(basename $(ps -hp $$ | awk "{print \\$$N}" | tail -n1)) = zsh

    source <(tea --magic=zsh)

    node --eval 'console.log(1)'
    `}).chmod(0o700)

  const out = await this.run({ args: [script.string] }).stdout()

  assertEquals(out, "1\n", out)
})

it(suite, "tea --magic in a script. bash", async function() {
  const script = this.sandbox.join("magic-bash").write({ text: undent`
    #!/bin/bash

    set -e

    if test $(uname) = Linux; then
      N=5
    else
      N=4
    fi

    test $(basename $(ps -hp $$ | awk "{print \\$$N}" | tail -n1)) = bash

    source <(tea --magic=bash)

    node --eval 'console.log(1)'
    `})

  const out = await this.run({ args: [script.string] }).stdout()

  assertEquals(out, "1\n", out)
})

it(suite, "tea --magic in a script. fish", async function() {
  const script = this.sandbox.join("magic-fish").write({ text: undent`
    #!/usr/bin/fish

    if test $(uname) = Linux
      set N 5
    else
      set N 4
    end

    test $(basename $(ps -hp $fish_pid | awk "{print \\$$N}" | tail -n1)) = fish

    tea --magic=fish | source

    export NODE_DISABLE_COLORS=1
    export CLICOLOR_FORCE=0
    export VERBOSE=-1  # no tea output FIXME doesn’t seem to work…?
    node --eval "console.log('xyz')"

    #FIXME with fish the command not found handler always returns 127 and we don’t know how to work around it
    exit 0
    `})

  // fish forces all output to stderr when running in the command not found handler
  const out = await this.run({ args: [script.string] }).stderr()

  // splitting it as stderr includes our output
  //FIXME I can't stop it doing color codes whatever I try
  let asserted = false
  for (const line of out.split("\n").compact(x => strip_ansi_escapes(x).trim())) {
    if (line.startsWith("tea:")) continue
    assertEquals(line, "xyz", `hi: ${line}`)
    asserted = true
    break
  }
  assert(asserted)
})
