import useConfig, { Config, ConfigDefault } from "../../src/hooks/useConfig.ts"
import { _internals as usePrintInternals } from "../../src/hooks/usePrint.ts"
import { _internals as useRunInternals } from "../../src/hooks/useRun.ts"
import { _internals as useConfigInternals } from "tea/hooks/useConfig.ts"
import { parseArgs } from "../../src/args.ts"
import { run } from "../../src/app.main.ts"
import { spy } from "deno/testing/mock.ts"
import { Path, utils, hooks } from "tea"
import { ExitError } from "../../src/hooks/index.ts"
const { useSync } = hooks
const { panic } = utils

/// we can’t exec in the tests or they immediately end!
useRunInternals.nativeRun = runWithoutExec


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
  let TEA_PANTRY_PATH: string | undefined
  let TEA_CACHE_DIR = Path.home().join(".tea/tea.xyz/var/www").isDirectory()?.string

  if (sync) {
    TEA_PANTRY_PATH = (Path.home().join(".tea/tea.xyz/var/pantry").isDirectory() ?? await mkpantry()).string
  }

  const runTea = async (args: string[], configOverrides: Partial<Config> = {}) => {
    const cwd = Deno.cwd()
    Deno.chdir(teaDir.string)

    const usePrintSpy = spy(usePrintInternals, "nativePrint")

    try {
      const [appArgs, flags] = parseArgs(args, teaDir.string)

      const env: Record<string, string> = {
        NO_COLOR: '1',
        PATH: "/usr/bin:/bin",
        VERBOSE: '-1',
        TEA_PREFIX: TEA_PREFIX.string,
      }
      if (TEA_CACHE_DIR) env['TEA_CACHE_DIR'] = TEA_CACHE_DIR
      if (TEA_PANTRY_PATH) env['TEA_PANTRY_PATH'] = TEA_PANTRY_PATH

      const config = ConfigDefault(flags, teaDir.string, env)

      useConfigInternals.reset()
      useConfig({
        ...config,
        ...configOverrides,
      })

      await run(appArgs)

      // ensure subsequent tests aren't polluted
      useConfigInternals.reset()

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

async function runWithoutExec({cmd: [cmd, ...args], env}: {cmd: string[], env: Record<string, string>}) {
  const proc = new Deno.Command(cmd, {args, env}).spawn()
  const { code, success } = await proc.status
  if (!success) {
    throw new ExitError(code)
  }
}

let __pantry: Path | undefined
async function mkpantry() {
  if (__pantry) return __pantry
  const tmp = new Path(await Deno.makeTempDir({ prefix: "tea.functional-tests." }))
  useConfigInternals.reset()
  useConfig(ConfigDefault(undefined, tmp.join('tea').string, { TEA_PREFIX: tmp.string }))
  await useSync()
  useConfigInternals.reset()
  return __pantry = tmp.join("tea.xyz/var/pantry")
}
