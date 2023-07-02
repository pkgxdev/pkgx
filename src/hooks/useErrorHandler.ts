import { hooks, PackageNotFoundError, PantryParseError, ResolveError, TeaError } from "tea"
import { useLogger, Verbosity, useConfig } from "hooks"
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
  if (err instanceof PackageNotFoundError) {
    const suggestion = await getClosestPackageSuggestion(err.project)
    return suggestion
      ? `did you mean \`${teal(suggestion)}\`? otherwise… see you on GitHub?`
      : undefined
  } else if (err instanceof ResolveError) {
    const versions = await useInventory().get(err.pkg)
    return `inventory: ${versions.join(", ")}`
  }
}

export default async function(err: Error) {
  const { logJSON, red, gray } = useLogger()
  const { verbosity, json } = useConfig().modifiers
  const silent = verbosity <= Verbosity.quiet
  const debug = verbosity >= Verbosity.debug

  if (silent) {
    //noop
  } else if (json) {
    logJSON({ error: true, message: err.message })
  } else if (debug) {
    console.error(`${red('error')}:`, JSON.stringify(err, null, 2))
  } else if (err instanceof PantryParseError) {
    // deno-lint-ignore no-explicit-any
    const attachment = `${err.project}: ${(err.cause as any)?.message ?? err.cause ?? 'unknown cause'}`
    console.error(undent`
      ${red('error')}: pantry entry invalid.

      PLEASE REPORT THIS BUG!

          https://github.com/teaxyz/pantry/issues/new

      ----------------------------------------------------->> attachment begin
      ${gray(attachment)}
      ------------------------------------------------------------------------
      ${gray(JSON.stringify(err.ctx, null, 2))}
      <<------------------------------------------------------- attachment end
      `)
  } else if (err instanceof TeaError) {
    console.error(`${red('error')}: ${err.message}`)
    const suggestion = await suggestions(err).swallow()
    if (suggestion) {
      console.error()
      console.error(suggestion)
      console.error()
    }
  } else if (!(err instanceof ExitError)) {
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
    console.debug("------------------------------------------------------------------------")
    console.debug(gray(JSON.stringify(err)))
    console.error("<<------------------------------------------------------- attachment end")

    if (!(err instanceof Error)) {
      throw err  // this way: deno will show the backtrace
    }
  }

  if (err instanceof ExitError) {
    return err.code
  } else if (err instanceof TeaError) {
    return 1
  } else {
    return 128
  }
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
