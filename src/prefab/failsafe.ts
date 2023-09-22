import { PackageNotFoundError, hooks } from "pkgx"
const { useSync } = hooks

export default async function failsafe<T>(body: () => Promise<T>): Promise<T> {
  try {
    return await body()
  } catch (err) {
    if (err instanceof PackageNotFoundError) {
      await _internals.useSync()
      return body()
    } else {
      throw err
    }
  }
}

export const _internals = {
  useSync
}
