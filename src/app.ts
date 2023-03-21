import { useErrorHandler } from "hooks"
import help from "./app.help.ts"
import { UsageError } from "utils"
import { run } from "./app.main.ts"
import { parseArgs } from "./args.ts";
import { init } from "./init.ts";
import useConfig from "./hooks/useConfig.ts";


try {
  const [args, flags] = parseArgs(Deno.args, Deno.execPath())
  init(flags)
  await run(args)
} catch (err) {
  if (err instanceof UsageError) {
    if (!useConfig().silent) await help()
    Deno.exit(64)
  } else {
    const code = await useErrorHandler(err)
    Deno.exit(code)
  }
}
