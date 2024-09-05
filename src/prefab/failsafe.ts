import { PackageNotFoundError, hooks } from "pkgx"
import Logger from "../utils/Logger.ts"
const { useSync } = hooks

export default async function failsafe<T>(body: () => Promise<T>): Promise<T> {
  try {
    return await body()
  } catch (err) {
    if (err instanceof PackageNotFoundError) {
      const logger: Logger = new Logger('sync')
      const printer = {
        syncing() {
          logger.replace('fetching')
        },
        caching() {
          logger.replace('caching')
        },
        syncd() {
          logger.clear()
        }
      }
      await _internals.useSync(printer)
      return body()
    } else {
      throw err
    }
  }
}

export const _internals = {
  useSync
}
