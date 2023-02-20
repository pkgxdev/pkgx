import * as logger from "./useLogger.ts"
import { usePantry, useFlags, usePrefix } from "hooks"
import { chuzzle, TeaError, undent } from "utils"
import Path from "path"

async function suggestions(err: TeaError) {
  switch (err.id) {
  case 'not-found: pantry: package.yml': {
    const suggestion = await usePantry().getClosestPackageSuggestion(err.ctx.project).swallow()
    return suggestion
      ? `did you mean \`${logger.teal(suggestion)}\`? otherwise… see you on GitHub?`
      : undefined
  }}
}

export default async function(err: Error) {
  const { silent, debug } = useFlags()

  if (silent) {
    return 1
  } else if (err instanceof TeaError) {
    if (!silent) {
      const suggestion = await suggestions(err).swallow()
      console.error(`${logger.red('error')}: ${err.title()} (${logger.gray(err.code())})`)
      if (suggestion) {
        console.error()
        console.error(suggestion)
        console.error()
      }
      console.error(msg(err))
      if (debug) console.error(err.ctx)
    }
    const code = chuzzle(parseInt(err.code().match(/\d+$/)?.[0] ?? '1')) ?? 1
    return code
  } else {
    const { stack, message } = err ?? {}

    const title = encodeURIComponent(`panic:${message ?? "null"}`).replaceAll('%20', '+')
    const url = `https://github.com/teaxyz/cli/issues/new?title=${title}`

    console.error()
    console.error(`${logger.red("panic")}:`, "spilt tea. we’re sorry and we’ll fix it… but you have to report the bug!")
    console.error()
    console.error("   ", logger.gray(url))
    console.error()
    console.error("----------------------------------------------------->> attachment begin")
    console.error(logger.gray(stack ?? "null"))
    console.debug("------------------------------------------------------------------------")
    console.debug({ err })
    console.error("<<----------------------------------------------------- attachment end")

    // this way: deno will show the backtrace
    if (err instanceof Error == false) throw err
    return 1
  }
}

/// this is here because error.ts cannot import higher level modules
/// like hooks without creating a cyclic dependency
function msg(err: TeaError): string {
  let msg = err.message
  const { ctx } = err

  switch (err.code()) {
  case 'spilt-tea-102':
    if (ctx.filename instanceof Path && !ctx.filename.in(usePrefix())) {
      // this yaml is being worked on by the user
      msg = `${ctx.filename.prettyLocalString()}: ${ctx.cause.message}`
    } else {
      const attachment = `${ctx.project}: ${ctx.cause.message}`
      msg = undent`
        pantry entry invalid. please report this bug!

            https://github.com/teaxyz/pantry.core/issues/new

        ----------------------------------------------------->> attachment begin
        ${logger.gray(attachment)}
        <<------------------------------------------------------- attachment end
        `
    }
  }

  return msg
}