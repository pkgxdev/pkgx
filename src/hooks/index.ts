// order is important to avoid circular dependencies and thus uncaught ReferenceErrors

import usePrefix from "hooks/usePrefix.ts"
import useOffLicense from "hooks/useOffLicense.ts"
import useDownload from "hooks/useDownload.ts"
import useCache from "hooks/useCache.ts"
import useCellar from "hooks/useCellar.ts"
import useExec from "hooks/useExec.ts"
import useFetch from "hooks/useFetch.ts"
import useInventory from "hooks/useInventory.ts"
import useShellEnv from "hooks/useShellEnv.ts"
import usePantry from "hooks/usePantry.ts"
import useVirtualEnv from "hooks/useVirtualEnv.ts"
import usePackageYAML, { usePackageYAMLFrontMatter } from "hooks/usePackageYAML.ts"
import useSync from "hooks/useSync.ts"
import useVersion from "hooks/useVersion.ts"
import useMoustaches from "hooks/useMoustaches.ts"
import useErrorHandler from "hooks/useErrorHandler.ts"
import usePrint from "hooks/usePrint.ts"
import useRun from "hooks/useRun.ts"
import useConfig, { useEnv } from "hooks/useConfig.ts"
import useDarkMagic from "hooks/useDarkMagic.ts"

// but we can sort these alphabetically
export {
  useCache,
  useCellar,
  useDownload,
  useErrorHandler,
  useExec,
  useFetch,
  useInventory,
  useMoustaches,
  useOffLicense,
  usePackageYAML,
  usePackageYAMLFrontMatter,
  usePantry,
  usePrefix,
  useShellEnv,
  useSync,
  useVersion,
  useVirtualEnv,
  usePrint,
  useRun,
  useConfig,
  useEnv,
  useDarkMagic,
}
