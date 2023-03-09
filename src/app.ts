import { useErrorHandler } from "hooks"
import useFlags, { useArgs } from "hooks/useFlags.ts"
import help from "./app.help.ts"
import { UsageError } from "utils"
import { run } from "./app.main.ts"

try {
  const [args] = useArgs(Deno.args, Deno.execPath())
  await run(args)
} catch (err) {
  if (err instanceof UsageError) {
    if (!useFlags().silent) await help()
    Deno.exit(64)
  } else {
    const code = await useErrorHandler(err)
    Deno.exit(code)
  }
}
