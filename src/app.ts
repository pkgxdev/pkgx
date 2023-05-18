import useConfig, { Config, ConfigDefault, Verbosity } from "./hooks/useConfig.ts"
import { parseArgs, UsageError } from "./args.ts"
import { useErrorHandler } from "hooks"
import { run } from "./app.main.ts"
import help from "./app.help.ts"

try {
  const [args, flags] = parseArgs(Deno.args, Deno.execPath())

  const config = ConfigDefault(flags)

  config.logger.prefix = (!Deno.isatty(Deno.stdout.rid) || Deno.env.get("CI")) ? "tea:" : undefined
  useConfig(config)
  applyVerbosity(config)

  await run(args)

} catch (err) {
  if (err instanceof UsageError) {
    console.error(err.message)
    await help()
    Deno.exit(64)
  } else {
    const code = await useErrorHandler(err)
    Deno.exit(code)
  }
}


function applyVerbosity(config: Config) {
  function noop() {}
  if (config!.modifiers.verbosity < Verbosity.debug) console.debug = noop
  if (config!.modifiers.verbosity < Verbosity.loud) console.log = noop
  if (config!.modifiers.verbosity < Verbosity.normal) {
    console.info = noop
    console.warn = noop
    console.log = noop
    console.error = noop
  }
}
