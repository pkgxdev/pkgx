import useFlags, { useArgs } from "hooks/useFlags.ts"
import useMagic from "hooks/useMagic.ts"
import dump from "./app.dump.ts"
import exec from "./app.exec.ts"
import help from "./app.help.ts"

const rawArgs = useArgs(Deno.args)
const { silent, verbose, magic, verbosity } = useFlags()

if (verbose) {
  const version = '0.1.0' //FIXME
  console.log(`tea ${version}`)
}

console.debug({ rawArgs })

if (rawArgs.cd) {
  const chdir = rawArgs.cd
  console.verbose({ chdir })
  Deno.chdir(chdir.string)
}

try {
  const { mode, ...args } = await useMagic(rawArgs)

  if (magic && (mode != 'help' || verbosity > 1)) {
    const foo = { ...args, mode, chdir: rawArgs.cd }
    console.verbose({"transformed-args": foo })
  }

  switch (mode) {
  case "dump":
    await dump(args)
    break

  case "exec":
    await exec(args)
    break

  case "help":
    await help()
    break
  }
} catch (err) {
  if (silent) {
    Deno.exit(1)
  } else {
    throw err
  }
}
