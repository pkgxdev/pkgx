import { assertSpyCall, stub, assertSpyCallArgs } from "https://deno.land/std@0.183.0/testing/mock.ts";
import { useVersion, useFetch } from "hooks";


Deno.test("fetch user-agent header check", async () => {
  const url = "https://tea.xyz/tea-cli/";
  const version = useVersion()
  
  const fetchStub = stub(
    globalThis,
    "fetch",
    () => Promise.resolve(new Response("")),
  );

  try {
    await useFetch(url, {});
  } finally {
    fetchStub.restore();
  }

  const expectedUserAgent = `tea.cli/${version}`;

  assertSpyCallArgs(fetchStub, 0, [url, {
    headers: {"User-Agent": expectedUserAgent}
  }]);

});