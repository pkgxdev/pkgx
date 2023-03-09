import Path from "path"
import { run } from "../../src/app.main.ts"
import { useArgs } from "hooks/useFlags.ts"
import { setTeaPrefix } from "../mocks/mockUsePrefix.ts"
import { getPrintedLines, resetLines } from "../mocks/mockUsePrint.ts"
import { _internals as useRunInternals } from "../mocks/mockUseRun.ts"

export const createTestHarness = async () => {
  const tmpDir = new Path(await Deno.makeTempDir({ prefix: "tea-" }))
  const teaDir = tmpDir.join("tea").mkdir()
  const TEA_PREFIX = tmpDir.join('opt').mkdir()

  setTeaPrefix(TEA_PREFIX.string);

  const [syncArgs] = useArgs(["--sync", "--silent"], teaDir.string)
  await run(syncArgs) 
  resetLines()

  return {
    teaDir,
    TEA_PREFIX,
    getPrintedLines,
    useRunInternals
  }
}
