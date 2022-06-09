![tea](https://tea.xyz/banner.png)

tea is a delightful developer tool that gives you and your team your time back
so you can concentrate on what matters: *building your app*.

tea is built with a set of primitives that make packaging *programmable*.
We made tea/cli with those primitives.
We want *you* to compose them and build completely new tools,
workflows and inventions that change how you work, how your team works or
even (especially) *how the world works*.

&nbsp;


# tea/cli 0.1.0

tea/cli is a universal interpreter:

```sh
$ tea https://github.com/teaxyz/demos/blob/main/ai.py input.png
tea: installing python^3
pip: installing dall-e-2
…

$ curl https://github.com/teaxyz/demos/blob/main/ai.py
#!/usr/bin/env tea
# ---
# dependencies:
#   python.org: ~3.8
#   python.org/pip/requests: ^2.18
#   optipng.sourceforge.net: '*'    # optipng will be in `PATH`
# ---
…
```

> <details><summary><i>Is this safe?</i></summary>
>
> If you’re worried about executing scripts from the Internet: *read them
> first!* tea only executes what the script tells it to; the dependency
> requirements are embedded in the script as YAML front-matter.
> </details>

&nbsp;


tea is a universal (and magical) virtual‑environment manager:

```
$ deno
zsh: command not found: deno

$ echo $PATH
/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin

$ cd my-project
$ deno
deno 1.22.1
> ^D

$ env
PATH=/opt/deno.land/v1.20.3/bin:/usr/bin:/bin
SRCROOT=/src/my-project
…
```

Don’t worry, this magic also works with [VSCode].

> <details><summary><i>What is this sourcery?</i></summary>
>
> tea uses a shell hook to insert the precise tooling your project needs into
> your shell environment. Development is now containerized at the
> *package manager* level. No longer do you need to worry about your team
> being on different versions of foundational tooling nor do you need to worry
> about system level updates breaking different projects you’re working on.
>
> Projects can specify precisely what they need and you can install those
> requirements precisely be it today, tomorrow or in ten years.
>
> In the above example if `deno` is not yet installed we insert a hook so
> trying to execute it will install it first.
> </details>

[VSCode]: https://code.visualstudio.com

&nbsp;


## A Brief Diatribe

Every programming language, every build system, every compiler, web server,
database and email client seem to gravitate towards adding infinite features
and complexity so that their users can do ever more and more.

This is against the UNIX philosophy: tools should do one thing and do that one
thing *damn* well, but they should be composable and flexible; built to be
combined, piped and utilized as part of a larger toolbox of unique and
excellent tools.

tea fills the gap that has prevented open source from fulfilling this goal for
some time now.

&nbsp;


# Getting Started

Installing tea is easy:

```sh
sh <(curl https://tea.xyz)
# prompts you to confirm you’re cool before doing anything
```

In fact, the tea one-liner abstracts away installation:

```sh
$ sh <(curl https://tea.xyz) https://example.com/script.ts

# works the same as:
$ tea https://example.com/script.ts
```

Now in your blog posts, tweets and tutorials you don’t have to start
with any “how to install tea” preamble nor will they need to google anything.
If they want to learn about tea first they can go to the same URL as they’re
curl’ing. Don’t forget we *will* be cross platform too so you can write one
line for everyone, anywhere.

> <details><summary><i>Installing Manually</i></summary>
>
> `tea` is a single binary that you can install yourself:
>
> ```sh
> curl -O https://dist.tea.xyz ~/.local/bin
> ```
>
> Now `tea`’s installed you can omit any instance of `sh <(curl tea.xyz)` and
> instead use your locally installed copy of `tea`.
>
> Our (optional) magic `PATH` restructuring requires a hook in your `~.zshrc`:
>
> ```sh
> add-zsh-hook -Uz chpwd (){ source <(tea -Eds) }
> ```
>
> If this sourcery offends you can use tea as an interpreter instead.
>
> </details>

> <details><summary><i>Uninstalling tea</i></summary>
>
> tea installs everything to `/opt` though other things may live there too, so
> don’t delete indiscriminately.
> We also install `/usr/local/bin/tea`.
> There’s also a one-liner added to your `~/.zshrc` you should remove.
> </details>

&nbsp;


## Usage as an Environment Manager

Fundamentally, tea is a Package Manager, but in usage it is more of an
environment manager. It installs specific versions of those fundamental tools
like node, python and go that you need to work on your project.

When you `cd` into a project in your terminal, tea sets up the environment so
your tools “just work”. To do this it looks for a dependencies table in
your `README`.

> Using the `README` may seem weird, but really it's the right place to
> document your dependencies. Typically in open source this information is
> barely documented, incorrectly documented or duplicated (incorrectly) in
> various hard to find places. No longer.
>
> <details><summary><i>Umm, I hate this, can I use a different file?</i></summary>
>
> You can use `package.json` instead:
>
> ```json
> {
>   "tea": {
>     "dependencies": [{ "nodejs.org": 18 }]
>   }
> }
> ```
>
> We check `README.md` before `package.json`. You can force use of
> `package.json` by disabling magic with `--muggle`.
>
> </details>

For an example see our [Dependencies](#dependencies) section (indeed, we use
tea to build tea).

You can check what environment this generates with `tea`:

```sh
tea --env --dump
```

`--env` specifies that tea will generate an environment based on the source
control checkout. So if you’re using git we’ll look around for a `.git`
directory and consider that the `SRCROOT` for your project. Then we check the
`README.md` there to gather the environment information.

tea attempts to enhance your environment based on your workspace context:

| Variable  | Description |
| --------- | ----------- |
| `VERSION` | Extracted from the Teafile |
| `SRCROOT` | We descend towards root until we find a source control marker, eg. `.git` |
| `MANPATH` | So `man …` works for your deps |

We also provide eg. `PKG_CONFIG_PATH`, `LD_LIBRARY_PATH`, etc. so other tools
can find your dependencies.

&nbsp;


## Usage as an Interpreter

You can use tea to execute pretty much any script. We’ll auto-magically
install the right interpreter (in an isolated way that won’t interfere with
any other tools on your system).

```sh
$ tea my-script.py
```

tea sees the `.py` file extension, so it installs the latest version of Python
and then executes the script.

If you want more control over the python version then we need to edit the
script’s YAML front-matter, eg:

```python
#!/usr/bin/env python

"""
---
dependencies:
  python.org: ^2.7
---
"""

# snip …
```

tea will run the script with the latest version of Python that is >=2.7 but
less than 3.0. If it's not installed we grab it, otherwise we use what is
available.


### Using a Shebang

You can `#!/usr/bin/env tea`, and you’d possibly choose this because tea can
do more than install dependencies. You may recall our earlier diatribe about
tools sticking to what they’re good at—*we really believe this*. Thus
having tools evolve to be configurable for project environments is something
we think should be left to *us*.

For example, `deno` is a wonderful interpreter for JavaScript and TypeScript,
but it has no project configuration capabilities which means if you want to
use it for scripts you may have to mess around a little. We think deno should
stay this way, and instead we can use tea:

```ts
#!/usr/bin/env -S tea -E

/* ---
dependencies:
  deno.land: ^1.18
args:
  - deno
  - run
  - --allow-net
  - --import-map={{ srcroot }}/import-map.json
--- */

// snip …
```

Which would go like this:

```sh
$ pwd
/src
$ tea ./script.ts my-arg
tea: /opt/deno.land/v1.18/bin/deno run \
  --allow-net \
  --import-map=/src/import-map.json \
  /src/script.ts \
  my-arg
```

> The `-E` (or `--env`) runs the script in the environment of your project,
> here we need it in order to use `$SRCROOT`, but you would use it for any
> project that has an environment your scripts might need. Probably your
> project already specifies your deno dependency, so the above YAML could
> remove that because `-E` is being used.

&nbsp;


## Caveats

tea is **new software** and not mature. If you are an enterprise, we don’t
recommend using tea *yet*. If you are devshop or open source developer then
welcome! Dig in 🤝.

We only support macOS (currently) and zsh (currently).

We intend to be cross platform, this includes Windows (WSL **and** non-WSL),
Raspberry Pi, all varieties of Linux. Building binaries for everything we
support.

tea allows you to “get started” anywhere (*just not quite yet*).

&nbsp;


# Magic

tea works with the concept of magic. While enabled we try to be clever and
infer what you want. When disabled we are strict and require precise
specification of your intent.

You can disable magic by specifying `--muggle` or defining `MAGIC=0` in your
environment.

&nbsp;


# Contributing

If you have suggestions or ideas, start a [discussion]. If we agree we’ll
move it to an issue. Bug fixes straight to pull request or issue please!

## Using A Local Checkout

```sh
git clone https://github.com/teaxyz/cli tea
cd tea
./scripts/self-install.ts
```

The script replaces `/usr/local/bin/tea` with a `deno` instantiation that runs
your checkout, (installing deno first ofc).

[discussion]: https://github.com/teaxyz/cli/discussions/new

&nbsp;


# FAQ

## What are you doing to my computer?

We install compartmentalized packages to `/opt`,we create one symlink
(`/usr/local/bin/tea`) and we add one line to your `.zshrc`.

## I thought you were decentralized and web3 and shit

tea is creating new technologies that will change how open source is funded.
This software is an essential part of that endeavor and is released
prior to our protocol in order bootstrap the open source revolution.

## I have another question

Start a [discussion] and we’ll get back to you.


&nbsp;

&nbsp;



# Appendix

## Philosophy

* Be non‑intrusive
    > don’t interfere with our users’ systems or habits
* Be “just works”
    > our users have better things to do than fix us
* Error messages must be excellent
    > trust that if it comes to it, our users can fix things provided we help them
* Be intuitive
    > being clever is good—but don’t be so clever nobody gets it
* Resist complexity
    > rethink the problem until a simpler solution emerges
* Be fast
    > we are in the way of our users’ real work, don’t make them wait

## Troubleshooting

### `env: tea: No such file or directory`

If you got this error message, you need to install tea:
`sh <(curl https://tea.xyz)`

## Dependencies

|   Project   | Version |  Lock  |
|-------------|---------|--------|
| deno.land   | ^1.18   | 1.20.3 |
| tea.xyz     | 0.1.0   | -      |

## Metadata

| Name     | Value |
|----------|-------|
| Version  | 0.1.0 |
