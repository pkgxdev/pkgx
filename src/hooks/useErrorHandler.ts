import * as logger from "./useLogger.ts"
import { usePantry, useFlags, usePrefix, useInventory } from "hooks"
import { chuzzle, TeaError, undent } from "utils"
import Path from "path"
import { ExitError } from "../types.ts"

async function suggestions(err: TeaError) {
  switch (err.id) {
  case 'not-found: pantry: package.yml': {
    const suggestion = await getClosestPackageSuggestion(err.ctx.project).swallow()
    return suggestion
      ? `did you mean \`${logger.teal(suggestion)}\`? otherwise… see you on GitHub?`
      : undefined
  }
  case 'not-found: pkg.version':
    if (err.ctx.pkg) {
      const versions = await useInventory().get(err.ctx.pkg)
      return `inventory: ${versions.join(", ")}`
    }
    break
  }
}

export default async function(err: Error) {
  const { silent, debug } = useFlags()

  if (err instanceof ExitError) {
    return err.code
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
  } else if (!silent) {
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
    return 128
  } else {
    return 1
  }
}

/// this is here because error.ts cannot import higher level modules
/// like hooks without creating a cyclic dependency
function msg(err: TeaError): string {
  let msg = err.message
  const { ctx } = err

  switch (err.code()) {
  case 'spilt-tea-009':
    if (ctx.filename instanceof Path && !ctx.filename.in(usePrefix())) {
      // this yaml is being worked on by the user
      msg = `${ctx.filename.prettyLocalString()}: ${ctx.cause?.message ?? 'unknown cause'}`
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

async function getClosestPackageSuggestion(input: string) {
  let choice: string | undefined
  let min = Infinity
  const pantry = usePantry()
  for await (const {project} of pantry.ls()) {
    if (min == 0) break

    pantry.getProvides({ project }).then(provides => {
      if (provides.includes(input)) {
        choice = project
        min = 0
      }
    })

    const dist = levenshteinDistance(project, input)
    if (dist < min) {
      min = dist
      choice = project
    }
  }
  return choice
}

function levenshteinDistance (str1: string, str2:string):number{
  const track = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null))
  for (let i = 0; i <= str1.length; i += 1) {
     track[0][i] = i
  }
  for (let j = 0; j <= str2.length; j += 1) {
     track[j][0] = j
  }
  for (let j = 1; j <= str2.length; j += 1) {
     for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        track[j][i] = Math.min(
           track[j][i - 1] + 1, // deletion
           track[j - 1][i] + 1, // insertion
           track[j - 1][i - 1] + indicator, // substitution
        );
     }
  }
  return track[str2.length][str1.length]
}
