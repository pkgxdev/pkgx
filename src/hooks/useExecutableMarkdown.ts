import Path from "path"
import { TeaError } from "../utils/index.ts";
import {Lexer, marked} from "marked";

interface Return {
  /// throws if not found
  findScript(name: string): string
}

type Parameters = { filename: Path } | { text: string }
type Script = { language: string; code: string; description: string }

export default function useExecutableMarkdown(parameters: Parameters) {
  const getLines = (() => (async () => {
    if ("filename" in parameters) {
      return await parameters.filename.read()
    } else {
      return parameters.text
    }
  })())

  const getScripts = async () => {
    const lines = await getLines()
    const result: Map<string, Script> = new Map()
    const tokens = Lexer.lex(lines, marked.defaults)
    let header: marked.Tokens.Heading | null = null
    let description: marked.Tokens.Paragraph | null = null;
    
    for (const token of tokens) {
      if (token.type === 'heading') {
        header = token
        description = null
      } else if (token.type === 'code' && token.lang === 'sh' && header !== null) {
        if (token.text.match(/^(#|\/\/)\s*tea\n/))
          result.set(header.text.toLowerCase().replace(/\s+/g, '-'), {
            language: token.lang,
            code: token.text,
            description: description ? description.text : ''
          })
        description = null
      } else if (token.type === 'paragraph') {
        description = token
      }
    }
    return result
  }

  const findScript = async (name: string) => {
    // firstly check if there is a target named args[0]
    // since we don’t want to allow the security exploit where you can make a file
    // and steal execution when a target was intended
    // NOTE user can still specify eg. `tea ./foo` if they really want the file
    name = name == '.' || !name?.trim() ? 'getting-started' : name

    const scripts = await getScripts()
    if (scripts.has(name)) return scripts.get(name) as Script
    throw new TeaError('not-found: exe/md: region', {script: name, ...parameters})
  }

  return { getScripts, findScript }
}
