import { useLogger, Verbosity, useConfig } from "hooks"
import { hooks, Path, TeaError } from "tea"
const { usePantry, useInventory } = hooks
import undent from "outdent"

// ExitError will cause the application to exit with the specified exit code if it bubbles
// up to the main error handler
export class ExitError extends Error {
  code: number
  constructor(code: number) {
    super(`exiting with code: ${code}`)
    this.code = code
  }
}

export async function suggestions(err: TeaError) {
  const { teal } = useLogger()
  switch (err.id) {
  case 'not-found: pantry: package.yml': {
    const suggestion = await getClosestPackageSuggestion(err.ctx.project).swallow()
    return suggestion
      ? `did you mean \`${teal(suggestion)}\`? otherwise… see you on GitHub?`
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
  const { logJSON, red, gray } = useLogger()
  const { verbosity, json } = useConfig().modifiers
  const silent = verbosity <= Verbosity.quiet
  const debug = verbosity >= Verbosity.debug

  if (err instanceof ExitError) {
    if (json) logJSON({ error: true })
    return err.code
  } else if (err instanceof TeaError) {
    if (json) {
      logJSON({ error: true, message: msg(err) })
    } else if (!silent) {
      const suggestion = await suggestions(err).swallow()
      console.error(`${red('error')}: ${err.title()} (${gray(err.code())})`)
      if (suggestion) {
        console.error()
        console.error(suggestion)
        console.error()
      }
      console.error(msg(err))
      if (debug) console.error(err.ctx)
    }
    const code = parseInt(err.code().match(/\d+$/)?.[0] ?? '1').chuzzle() ?? 1
    return code
  } else if (json) {
    logJSON({ error: true, message: err.message })
    return 1
  } else if (!silent) {
    const { stack, message } = err ?? {}

    const title = encodeURIComponent(`panic:${message ?? "null"}`).replaceAll('%20', '+')
    const url = `https://github.com/teaxyz/cli/issues/new?title=${title}`

    console.error()
    console.error(`${red("panic")}:`, "spilt tea. we’re sorry and we’ll fix it… but you have to report the bug!")
    console.error()
    console.error("   ", gray(url))
    console.error()
    console.error("----------------------------------------------------->> attachment begin")
    console.error(gray(stack ?? "null"))
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
  const { gray } = useLogger()
  let msg = err.message
  const { ctx } = err

  switch (err.code()) {
  case 'spilt-tea-007':
    if (ctx.filename instanceof Path && !ctx.filename.string.startsWith(useConfig().prefix.string)) {
      // this yaml is being worked on by the user
      msg = `${ctx.filename.prettyLocalString()}: ${ctx.cause?.message ?? 'unknown cause'}`
    } else {
      const attachment = `${ctx.project}: ${ctx.cause?.message ?? 'unknown cause'}`
      msg = undent`
        pantry entry invalid. please report this bug!

            https://github.com/teaxyz/pantry/issues/new

        ----------------------------------------------------->> attachment begin
        ${gray(attachment)}
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

    pantry.project(project).provides().then(provides => {
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
