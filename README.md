![tea](https://tea.xyz/banner.png)

tea is a delightful developer tool designed to give back your time so you
can concentrate on what matters: *building your app*. tea is made by
developers for developers.

&nbsp;


tea is a universal interpreter:

```sh
$ tea https://github.com/teaxyz/demos/blob/main/ai.py input.png
tea: installing python^3
pip: installing dall-e-2
```

> <details><summary>
>
> Is this safe? ⤵
> </summary>
>
> If you’re worried about executing scripts from the Internet: *read them
> first!* tea only executes what the script tells it to; the dependency
> requirements are embedded in the script as YAML front-matter.
> </details>

&nbsp;

tea is a universal (and magical) virtual‑environment manager:

```
$ deno --version
zsh: command not found: deno

$ echo $PATH
/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin

$ cd my-project
$ deno --version
deno 1.20.3

$ env
PATH=/opt/deno.land/v1.20.3/bin:/usr/bin:/bin
SRCROOT=/src/my-project
…
```

> <details><summary>
>
> *What is this sourcery?* ⤵
> </summary>
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

&nbsp;

The package manager is—in fact—just an implementation detail:

```
$ cd my-project
$ tea -E scripts/run.sh
tea: installing: python.org~2.7, postgresql.org*
tea: running: /opt/python.org/v2.7.18/bin/python scripts/run.sh
…
```

> <details><summary>
>
> Woah there! Where are you installing all this stuff? ⤵
> </summary>
>
> Everything installs to isolated “kegs” in `/opt`:
>
> ```sh
> $ ls /opt
> /opt/deno.land/v1.20.3
> /opt/deno.land/v1.20    # symlinks to v1.20.3
> /opt/deno.land/v1       # symlinks to v1.20.3
> ```
>
> That’s it. Indeed—nothing installs to a global prefix or has impact on
> anything else installed to your machine.
>
> </details>

&nbsp;

Really tea is a universal interpreter:

```python
#!/usr/bin/env tea
# ---
# dependencies:
#   python.org: ~3.8
#   python.org/pip/requests: ^2.18
#   http://optipng.sourceforge.net: '*'   # optipng will be in `PATH`
# ---

if sys.argv[1:] == "--help"
  print("usage: sh <(curl tea.xyz) https://example.com/favicon.py [input.img]")

# [snip]…
```


&nbsp;

## A Brief Diatribe

Every programming language, every build system, every compiler, web server,
database and email client seem to gravitate towards adding infinite features
and complexity so that their users can do more and more.

We believe this is wrong: tools should focus on what they’re good at. Instead
of duplicating functionality and adding complexity *you* should be able to
compose your tools and create only what you can imagine. tea enables that
composability: it’s the programmable, composable package manager that aims to
empower you to do more with what you already have.


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

> <details><summary>
>
> *Installing Manually* ⤵
> </summary>
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

> <details><summary>
>
> *Uninstalling tea* ⤵
> </summary>
>
> tea installs everything to `/opt` though other things may live there too, so
> don’t delete indiscriminately. There’s also a one-liner added to your
> `~/.zshrc` you should remove.
> </details>

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


> <details><summary>
>
> *Umm, I hate this, can I use a different file?* ⤵
> </summary>
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


---

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
| tea.xyz     | 0.01    | -      |

## Metadata

| Name     | Value |
|----------|-------|
| Version  | 0.1.0 |
