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

    node^18 --eval 'console.log(1)'
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

    node^18 --eval 'console.log(1)'
    `})

  const out = await this.run({ args: [script.string] }).stdout()

  assertEquals(out, "1\n", out)
})

it(suite, "tea --magic in a script. fish", async function() {
  // fish doesn’t error if there's an error when sourcing our magic script
  // so instead we verify each part of our magic is working separately

  const script = this.sandbox.join("magic-fish").write({ text: undent`
    #!/usr/bin/fish

    if test $(uname) = Linux
      set N 5
    else
      set N 4
    end

    if which node
      exit 2
    end

    test $(basename $(ps -hp $fish_pid | awk "{print \\$$N}" | tail -n1)) = fish

    tea --magic=fish | source

    export NODE_DISABLE_COLORS=1
    export CLICOLOR_FORCE=0
    export VERBOSE=-1  # no tea output FIXME doesn’t seem to work…?

    # we write a file because currently there's a bug where
    # fish cannot redirect from the command not found handler

    node^18 --eval "require('fs').writeFileSync('node.out', 'xyz.tea.hi')"

    if test "$(cat node.out)" != xyz.tea.hi
      exit 3
    end

    # check again
    if which node
      exit 2
    end

    echo 'dependencies: { node: ^18 }' > ./tea.yaml

    cd .
    node --version
    `})

  await this.run({ args: [script.string] })
})


it(suite, "tea verify --magic is parsed correctly by fish", async function() {
  const script = this.sandbox.join("magic-fish").write({ text: undent`
    #!/usr/bin/fish

    tea --magic=fish | source

    `})

  // fish doesn't have an equivalent of bash's "set -e" to exit the script if an error occurs
  // for more information go here: https://github.com/fish-shell/fish-shell/issues/510
  // we will assume if stderr contains anything that isn't prefixed with tea that then 
  // an error occurred
  const stderr = await this.run({ args: [script.string] }).stderr()

  const errorLines = stderr.split("\n")
    .compact(x => strip_ansi_escapes(x).trim())
    .filter(x => !x.startsWith("tea:"))
  assertEquals(errorLines, [])
})
