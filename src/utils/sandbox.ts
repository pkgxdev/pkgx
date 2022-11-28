async function createSandboxProfile() : Promise<string> {
    // create a sandbox profile that disallows
    const profile = `
;;; This sandbox-exec configuration disables writes to files under TEA_PREFIX
;;;
;;; Can be tested/verified by launching a new sandboxed shell:
;;; $ sandbox-exec -f /path/to/sandbox-profile -D TEA_PREFIX="$HOME/.tea" fish

(version 1)
(define tea-prefix (param "TEA_PREFIX"))
(allow default)
(deny file-write* (subpath tea-prefix))
`

    const fp = await Deno.makeTempFile()
    await Deno.writeTextFile(fp, profile)
    return fp
}

export async function sandboxExecCmd(cmd: string[], teaPrefix: string) {
    return ["sandbox-exec", 
    "-f", await createSandboxProfile(),
    "-D", `TEA_PREFIX=${teaPrefix}`,
    "--", ...cmd]
  }
  