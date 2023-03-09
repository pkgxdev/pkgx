import { default as realUsePrint } from "../../src/hooks/usePrint.ts"

const printedLines: string[] = [];

export const getPrintedLines = () => [...printedLines]
export const resetLines = () => printedLines.length = 0

export default function usePrint() {
  const { print } = realUsePrint()

  return {
    print: (msg: string) => {
      printedLines.push(msg)
      return print(msg);
    }
  }
}
