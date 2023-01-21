import {which} from "hooks/useExec.ts";

export default async function provides(args: string[]) {
  let status = 0;
  for (const arg of args) {
    const provides = await which(arg);
    if (!provides) status = 1;
  }
  Deno.exit(status);
}