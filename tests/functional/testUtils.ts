import Path from "path"
import { run } from "../../src/app.main.ts"
import { parseArgs } from "../../src/args.ts"
import { Config } from "../../src/hooks/useConfig.ts"
import { init } from "../../src/init.ts";
import { _internals as usePrintInternals } from "hooks/usePrint.ts"
import { _internals as useConfigInternals } from "hooks/useConfig.ts"
import { _internals as useRunInternals } from "hooks/useRun.ts"
import { spy } from "deno/testing/mock.ts"

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
  const teaDir = tmpDir.join(dir).mkdir()

  const TEA_PREFIX = tmpDir.join('opt').mkdir()

  if (sync) {
    const [syncArgs, flags] = parseArgs(["--sync", "--silent"], teaDir.string)
    init(flags)
    updateConfig({ teaPrefix: new Path(TEA_PREFIX.string), env: { NO_COLOR: "1" } })
    await run(syncArgs) 
  }

  const runTea = async (args: string[], configOverrides: Partial<Config> = {}) => {
    const cwd = Deno.cwd()
    Deno.chdir(teaDir.string)

    const usePrintSpy = spy(usePrintInternals, "nativePrint")

    useConfigInternals.getEnvAsObject = () => {
      return (useConfigInternals.getConfig()?.env ?? {}) as {[index: string]: string}
    }

    try {
      const [appArgs, flags] = parseArgs(args, teaDir.string)
      init(flags)
      updateConfig({ execPath: teaDir, teaPrefix: new Path(TEA_PREFIX.string), ...configOverrides })

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

// updates the application config by only overriding the provided keys
function updateConfig(updated: Partial<Config>) {
  const config = useConfigInternals.getConfig()
  if (!config) {
    throw new Error("test attempted to updated config that has not been applied")
  }
  useConfigInternals.setConfig({...config, ...updated, env: {...config.env, ...updated.env}})
}

// the Deno.Process object cannot be created externally with `new` so we'll just return a 
// ProcessLike object
export function newMockProcess(statusFunction?: () => Promise<Deno.ProcessStatus>): Deno.Process {
  const status = statusFunction ?? (() => Promise.resolve({success: true, code: 0}))
  return {
    status,
    output: () => Promise.resolve(""),
    stderrOutput: () => Promise.resolve(""),
    close: () => {
    },
  } as unknown as Deno.Process
}
