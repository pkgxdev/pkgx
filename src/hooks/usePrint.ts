const encoder = new TextEncoder()

export default function usePrint() {
  const print = _internals.nativePrint

  return {
    print 
  }
}

const nativePrint = (msg: string) => Deno.stdout.write(encoder.encode(`${msg}\n`))

// _internals is used for testing
export const _internals = {
  nativePrint
}
