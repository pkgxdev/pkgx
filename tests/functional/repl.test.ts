import { assertEquals, assertRejects } from "deno/testing/asserts.ts"
import { createTestHarness, newMockProcess } from "./testUtils.ts"
import { stub, returnsNext } from "deno/testing/mock.ts"
import { ExitError } from "../../src/hooks/useErrorHandler.ts"

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
        await run(["sh"], { env: { SHELL: shell, obj: {} } })
      } finally {
        useRunStub.restore()
      }

      const foo = [useRunStub.calls[0].args[0], ...useRunStub.calls[0].args[1].args!]
      assertEquals(foo, expectedCmd)

      const { env } = useRunStub.calls[0].args[1]
      assertEquals(env?.["TEA_PREFIX"], TEA_PREFIX.string)
      Object.entries(expectedEnv).forEach(([key, value]) => {
        assertEquals(env?.[key], value)
      })
    })
  }
})


Deno.test("repl errors", { sanitizeResources: false, sanitizeOps: false }, async test => {
  await test.step("run error", async () => {
    const {run, useRunInternals } = await createTestHarness()

    const mockProc = newMockProcess(() => Promise.resolve({success: false, code: 123, signal: null}))

    const useRunStub = stub(useRunInternals, "nativeRun", returnsNext([mockProc]))

    await assertRejects(async () => {
      try {
        await run(["sh"])
      } finally {
        useRunStub.restore()
      }
    }, ExitError, "exiting with code: 123", "should throw exit error")
  })

  await test.step("other error", async () => {
    const {run, useRunInternals } = await createTestHarness()

    const mockProc = newMockProcess(() => Promise.reject(new Error("test error")))

    const useRunStub = stub(useRunInternals, "nativeRun", returnsNext([mockProc]))

    await assertRejects(async () => {
      try {
        await run(["sh"])
      } finally {
        useRunStub.restore()
      }
    }, "test error")
  })
})
