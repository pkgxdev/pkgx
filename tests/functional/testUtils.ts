import { Config, ConfigDefault } from "../../src/hooks/useConfig.ts"
import { _internals as usePrintInternals } from "../../src/hooks/usePrint.ts"
import { _internals as useRunInternals } from "../../src/hooks/useRun.ts"
import { spy } from "deno/testing/mock.ts"
import { parseArgs } from "../../src/args.ts"
import { run } from "../../src/app.main.ts"
import { Path, hooks } from "tea"
const { useConfig } = hooks

export interface TestConfig {
  // run tea sync during test setup.  Default: true
  sync?: boolean
  // the directory within the tmp dir to run the test in.  Default: tea
  dir?: string
}

export const createTestHarness = async (config?: TestConfig) => {
  const sync = config?.sync ?? true
  const dir = config?.dir ?? "tea"

  const tmpDir = new Path(await Deno.makeTempDir({ prefix: "tea-" })).realpath()
  const teaDir = tmpDir.join(dir).mkdir('p')

  const TEA_PREFIX = tmpDir.join('opt').mkdir()

  if (sync) {
    const [syncArgs, flags] = parseArgs(["--sync", "--silent"], teaDir.string)
    const config = ConfigDefault(flags, teaDir.string, undefined, { NO_COLOR: '1' })
    useConfig({
      ...config,
      prefix: TEA_PREFIX
    })
    await run(syncArgs)
  }

  const runTea = async (args: string[], configOverrides: Partial<Config> = {}) => {
    const cwd = Deno.cwd()
    Deno.chdir(teaDir.string)

    const usePrintSpy = spy(usePrintInternals, "nativePrint")

    try {
      const [appArgs, flags] = parseArgs(args, teaDir.string)

      const config = ConfigDefault(flags, teaDir.string, undefined, { NO_COLOR: '1', PATH: "/usr/bin:/bin" })
      config.arg0 = teaDir

      useConfig({
        ...config,
        prefix: TEA_PREFIX,
        ...configOverrides,
      })

      await run(appArgs)

    } finally {
      usePrintSpy.restore()
      Deno.chdir(cwd)
    }

    return {
      stdout: usePrintSpy.calls.map(c => c.args[0])
    }
  }

  return {
    run: runTea,
    tmpDir,
    teaDir,
    TEA_PREFIX,
    useRunInternals,
  }
}

// the Deno.Process object cannot be created externally with `new` so we'll just return a
// ProcessLike object
export function newMockProcess(status?: () => Promise<Deno.CommandStatus>): Deno.Command {
  return {
    output: function(): Promise<Deno.CommandOutput> { throw new Error("UNIMPLEMENTED") },
    outputSync(): Deno.CommandOutput { throw new Error("UNIMPLEMENTED") },
    spawn: () => ({
      pid: 10,
      stdin: new WritableStream<Uint8Array>(),
      stdout: new ReadableStream<Uint8Array>(),
      stderr: new ReadableStream<Uint8Array>(),
      status: status ? status() : Promise.resolve({ success: true, code: 0, signal: null }),
      output: () => Promise.resolve({ stdout: new Uint8Array(), stderr: new Uint8Array(), success: false, code: 1, signal: null }),
      kill: _ => {},
      ref: () => {},
      unref: () => {}
    })
  }
}
