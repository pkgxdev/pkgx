const encoder = new TextEncoder()

export default function usePrint() {
  const print = (msg: string) => Deno.stdout.write(encoder.encode(`${msg}\n`))

  return {
    print 
  }
}
