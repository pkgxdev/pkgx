// order is important to avoid circular dependencies and thus uncaught ReferenceErrors

import usePrefix from "./usePrefix.ts"
import useOffLicense from "./useOffLicense.ts"
import useDownload from "./useDownload.ts"
import useCache from "./useCache.ts"
import useCellar from "./useCellar.ts"
import useExec from "./useExec.ts"
import useFlags from "./useFlags.ts"
import useGitHubAPI from "./useGitHubAPI.ts"
import useInventory from "./useInventory.ts"
import useShellEnv from "./useShellEnv.ts"
import useSourceUnarchiver from "./useSourceUnarchiver.ts"
import usePantry from "./usePantry.ts"
import useVirtualEnv from "./useVirtualEnv.ts"
import usePackageYAML, { usePackageYAMLFrontMatter } from "./usePackageYAML.ts"
import useSync from "./useSync.ts"
import useVersion from "./useVersion.ts"
import useMoustaches from "./useMoustaches.ts"
import useErrorHandler from "./useErrorHandler.ts"

// but we can sort these alphabetically
export {
  useCache,
  useCellar,
  useDownload,
  useErrorHandler,
  useExec,
  useFlags,
  useGitHubAPI,
  useInventory,
  useMoustaches,
  useOffLicense,
  usePackageYAML,
  usePackageYAMLFrontMatter,
  usePantry,
  usePrefix,
  useShellEnv,
  useSourceUnarchiver,
  useSync,
  useVersion,
  useVirtualEnv,
}
