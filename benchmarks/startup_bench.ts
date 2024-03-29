import { assert } from "deno/assert/mod.ts";

const gitVersion = "2.44.0";

function assertGitOutput(output: Deno.CommandOutput) {
  assert(output.code === 0);
  assert(new TextDecoder().decode(output.stdout) === `git version ${gitVersion}\n`);
  assert(new TextDecoder().decode(output.stderr) === "");
}

// Run the command before the benchmark to ensure git is bootstrapped
const command = new Deno.Command("./pkgx", {
  args: [`git@${gitVersion}`, "--version"],
});
const output = await command.output();
assertGitOutput(output);

Deno.bench("git --version", { permissions: { run: true, env: true }, group: "startup", baseline: true }, async (b) => {
  const gitBin = `${Deno.env.get("HOME")}/.pkgx/git-scm.org/v${gitVersion}/bin/git`
  const command = new Deno.Command(gitBin, {
    args: ["--version"],
  });
  b.start();
  const output = await command.output();
  b.end();
  assertGitOutput(output);
});

Deno.bench("pkgx git --version", { permissions: { run: true }, group: "startup" }, async (b) => {
  const command = new Deno.Command("./pkgx", {
    args: [`git@${gitVersion}`, "--version"],
  });
  b.start();
  const output = await command.output();
  b.end();
  assertGitOutput(output);
});
