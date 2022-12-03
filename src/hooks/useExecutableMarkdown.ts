import Path from "path"
import { TeaError } from "../utils/index.ts";

interface Return {
  /// throws if not found
  findScript(name: string): string
}

type Parameters = { filename: Path } | { text: string }

export default function useExecutableMarkdown(parameters: Parameters) {
  const getLines = (() => (async () => {
    if ("filename" in parameters) {
      return await parameters.filename.read()
    } else {
      return parameters.text
    }
  })().then(x => x.split("\n")[Symbol.iterator]()))

  const findScript = async (name: string) => {
    // firstly check if there is a target named args[0]
    // since we don’t want to allow the security exploit where you can make a file
    // and steal execution when a target was intended
    // NOTE user can still specify eg. `tea ./foo` if they really want the file
    name = name == '.' || !name?.trim() ? 'getting-started' : name

    const lines = await getLines()

    const header_rx = new RegExp(`^#+\\s+(.*)\\s*$`)
    for (const line of lines) {
      const match = line.match(header_rx)
      if (!match) continue
      if (match[1].toLowerCase().replace(/\s+/, '-') == name) {
        break
      }
    }

    do {
      const {value: line, done} = lines.next()
      if (done) throw new TeaError('not-found: exe/md: region', {script: name, ...parameters})
      if (!line.trim()) continue
      if (line.match(/^```sh\s*$/)) break
    } while (true)

    const sh: string[] = []
    for (const line of lines) {
      if (line.match(/^```\s*$/)) return sh.join("\n")
      sh.push(line.replace(/^\$\s*/, ''))
    }

    throw { error: true, script: name, ...parameters, code: "exe/md:cannot-parse" }
  }

  return { findScript }
}
