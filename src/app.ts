import useFlags, { useArgs } from "hooks/useFlags.ts"
import useMagic from "hooks/useMagic.ts"
import dump from "./app.dump.ts"
import exec from "./app.exec.ts"
import help from "./app.help.ts"

const rawArgs = useArgs(Deno.args)
const { silent, verbose, magic, verbosity } = useFlags()
const version = '0.0.0-α'

if (rawArgs.cd) {
  const chdir = rawArgs.cd
  console.verbose({ chdir })
  Deno.chdir(chdir.string)
}

try {
  const { mode, ...args } = await useMagic(rawArgs)

  if (mode == "exec") {
    console.verbose(`tea ${version}`)
    await exec(args)
  } else switch (mode[1]) {
    case "env":
      await dump(args)
      break
    case "help":
      await help()
      break
    case "version":
      console.log(`tea ${version}`)
    }
} catch (err) {
  if (silent) {
    Deno.exit(1)
  } else {
    throw err
  }
}
