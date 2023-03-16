import { assertEquals } from "https://deno.land/std@0.176.0/testing/asserts.ts"
import { stub, returnsNext } from "https://deno.land/std@0.176.0/testing/mock.ts"
import { createTestHarness, newMockProcess } from "./testUtils.ts"

Deno.test("should enter repl - sh", { sanitizeResources: false, sanitizeOps: false }, async test => { 
  const tests = [
    { 
      shell: "/bin/sh",
      expectedCmd: ["/bin/sh", "-i"],
      expectedEnv: {"PS1": "\\[\\033[38;5;86m\\]tea\\[\\033[0m\\] %~ "},
    },
    {
      shell: "/bin/bash",
      expectedCmd: ["/bin/bash", "--norc", "--noprofile", "-i"],
      expectedEnv: {"PS1": "\\[\\033[38;5;86m\\]tea\\[\\033[0m\\] %~ "},
    },
    {
      shell: "/bin/zsh",
      expectedCmd: ["/bin/zsh", "-i", "--no-rcs", "--no-globalrcs"],
      expectedEnv: {"PS1": "%F{086}tea%F{reset} %~ "}
    },
    {
      shell: "/bin/elvish",
      expectedCmd: ["/bin/elvish", "-i", "-norc"],
      expectedEnv: {}
    },
    {
      shell: "/bin/fish",
      expectedCmd: [
        "/bin/fish", "-i", '--no-config', '--init-command',
        'function fish_prompt; set_color 5fffd7; echo -n "tea"; set_color grey; echo " %~ "; end'
      ],
      expectedEnv: {}
    }
  ]

  for (const {shell, expectedCmd, expectedEnv} of tests) {
    await test.step(shell, async () => {
      const {run, TEA_PREFIX, useRunInternals } = await createTestHarness()
      const useRunStub = stub(useRunInternals, "nativeRun", returnsNext([newMockProcess()]))

      try {
        await run(["sh"], { env: { SHELL: shell } }) 
      } finally {
        useRunStub.restore()
      }

      assertEquals(useRunStub.calls[0].args[0].cmd, expectedCmd)

      const { env } = useRunStub.calls[0].args[0]
      assertEquals(env?.["TEA_PREFIX"], TEA_PREFIX.string)
      Object.entries(expectedEnv).forEach(([key, value]) => {
        assertEquals(env?.[key], value)
      })
    })
  }
})
