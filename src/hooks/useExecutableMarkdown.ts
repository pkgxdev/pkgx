import Path from "path"

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
      if (done) throw { error: true, script: name, ...parameters, code: "exe/md:no-region" }
      if (!line.trim()) continue
      if (line.match(/^```sh\s*$/)) break
    } while (true)

    const sh: string[] = []
    for (const line of lines) {
      if (line.match(/^```\s*$/)) return sh.join("\n")
      sh.push(line)
    }

    throw { error: true, script: name, ...parameters, code: "exe/md:cannot-parse" }
  }

  return { findScript }
}
