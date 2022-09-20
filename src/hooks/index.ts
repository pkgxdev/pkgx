// order is important to avoid circular dependencies and thus uncaught ReferenceErrors

import usePrefix from "./usePrefix.ts"
import useDownload from "./useDownload.ts"
import useCache from "./useCache.ts"
import useCellar from "./useCellar.ts"
import useExecutableMarkdown from "./useExecutableMarkdown.ts"
import useFlags from "./useFlags.ts"
import useGitHubAPI from "./useGitHubAPI.ts"
import useInventory from "./useInventory.ts"
import useShellEnv from "./useShellEnv.ts"
import useSourceUnarchiver from "./useSourceUnarchiver.ts"
import usePantry from "./usePantry.ts"
import useVirtualEnv from "./useVirtualEnv.ts"
import useMagic from "./useMagic.ts"

// but we can sort these alphabetically
export {
  useCache,
  useCellar,
  useDownload,
  useExecutableMarkdown,
  useFlags,
  useGitHubAPI,
  useInventory,
  useMagic,
  usePantry,
  usePrefix,
  useShellEnv,
  useSourceUnarchiver,
  useVirtualEnv
}
