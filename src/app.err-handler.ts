import * as logger from "./hooks/useLogger.ts"
import { usePantry, useFlags } from "hooks"
import { TeaError, UsageError } from "utils"
import help from "./app.help.ts"

async function suggestions(err: TeaError) {
  switch (err.id) {
  case 'not-found: pantry: package.yml': {
    const suggestion = await usePantry().getClosestPackageSuggestion(err.ctx.project)
    return `did you mean \`${suggestion}\`?`
  }}
}

export default async function(err: Error) {
  const { silent, debug } = useFlags()

  if (silent) {
    Deno.exit(1)
  } else if (err instanceof UsageError) {
    await help()
    Deno.exit(1)
  } else if (err instanceof TeaError) {
    const suggestion = await suggestions(err)
    console.error(`${logger.red('error')}: ${err.title()} (${logger.gray(err.code())})`)
    if (suggestion) {
      console.error()
      console.error(logger.gray(suggestion))
      console.error()
    }
    console.error(err.message)
    if (debug) console.error(err.ctx)
  } else {
    const { stack, message } = err ?? {}

    const title = encodeURIComponent(`panic:${message ?? "null"}`).replaceAll('%20', '+')
    const url = `https://github.com/teaxyz/cli/issues/new?title=${title}`

    console.error()
    console.error(`${logger.red("panic")}:`, "split tea. we’re sorry and we’ll fix it… but you have to report the bug!")
    console.error()
    console.error("   ", logger.gray(url))
    console.error()
    console.error("----------------------------------------------------->> attachment begin")
    console.error(logger.gray(stack ?? "null"))
    console.debug("------------------------------------------------------------------------")
    console.debug({ err })
    console.error("<<------------------------------------------------------- attachment end")

    // this way: deno will show the backtrace
    if (err instanceof Error == false) throw err
  }
}
