import { fromFileUrl } from "deno/path/from_file_url.ts"
import { Logger } from "../prefab/install.ts"
import { faker } from "npm:@faker-js/faker"
import { Path } from "pkgx"

export default faker

export function faker_args() {
  let arg0 = faker.system.fileName({ extensionCount: 0 })
  arg0 = `_${arg0}` // ensure we don’t accidentally call a real utility lol
  const args = faker.word.words({count: { min: 2, max: 10 }}).split(" ")
  return [arg0, ...args]
}

// putting here as putting it in devenv.test.ts caused those tests to once per import
export const fixturesd = new Path(fromFileUrl(import.meta.url)).parent().parent().parent().join('fixtures')

export const null_logger: Logger = {
  replace: () => {},
  clear: () => {},
  upgrade: () => undefined
}
