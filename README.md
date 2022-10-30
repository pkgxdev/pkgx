![tea](https://tea.xyz/banner.png)

*tea is not a package manager*: it’s *unified packaging infrastructure*.
It’s a single binary download for all platforms to make it so you don’t have
to spare a brain cycle for tooling, build systems, libraries, vendors or any
of that bullshit that isn’t *your code* because your code—that’s your part and
that part; it’s going to *change the world*.

&nbsp;


# tea/cli 0.11.2

tea is a universal virtual‑environment manager:

```sh
$ deno
zsh: command not found: deno

$ echo $PATH
/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin

$ cd my-project
$ deno
deno 1.22.1
> ^D

$ env
PATH=~/.tea/deno.land/v1.20.3/bin:/usr/bin:/bin
SRCROOT=/src/my-project
VERSION=…
…
```

You need 34 dependencies to compile our white-paper but with tea there’s
nothing to think about:

```sh
$ git clone https://github.com/teaxyz/white-paper
$ cd white-paper
$ make
tea: installing dependencies…
…
$ open tea.white-paper.pdf
```

> <details><summary><i>What is this sourcery?</i></summary><br>
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

> <details><summary><i>Fear not! This works with your other shit…</i></summary><br>
>
> Fear not, this magic works with things like [VSCode] too (we don’t believe in
> forcing or restricting your choice of tooling).
> </details>

> <details><summary><i>PSA:</i> Stop using Docker</summary><br>
>
> Docker is great for deployment and cross compilation, but… let’s face it: it
> sucks for dev.
>
> *Docker stifles builders*.
> It constricts you; you’re immalleable; tech marches onwards but your docker
> container remains immobile.
>
> Keep deploying with Docker, but use tea to develop (and when you deploy, use
> tea to install your deps).
> </details>

&nbsp;


tea is a universal interpreter:

```sh
$ tea https://github.com/teaxyz/demos/blob/main/demo.go input.txt
tea: installing go 1.18.3
go: running demo.go
…
```

We infer interpreter from the extension, shebang, YAML front matter or
open graph metadata (we’ve added packaging extensions).

> <details><summary><i>Is this safe?</i></summary><br>
>
> If you’re worried about executing scripts from the Internet: *read them
> first!* tea only executes what the script tells it to; the dependency
> requirements are embedded in the script as YAML front-matter.
> </details>

&nbsp;


tea is a universal dependency manager†:

```sh
$ tea https://github.com/teaxyz/demos/blob/main/ai-image-gen.py input.png
tea: installing python^3
pip: installing pytorch.org^1.11
…
ai-image-gen: optimizing output.png

$ curl https://github.com/teaxyz/demos/blob/main/ai.py
#!/usr/bin/env tea
# ---
# dependencies:
#   python.org: ~3.8
#   pypi.org/pytorch: ^1.11
#   optipng.sourceforge.net: '*'    # optipng will be in `PATH`
# ---
…
```

> † we use the term dependency manager for tools like npm, pip, cargo and gem
> that install packages for programming languages. They are variants of
> package managers. tea blurs the line between these tools.

&nbsp;


tea makes [Markdown] executable:

```sh
$ tea https://github.com/teaxyz/demos/favicon-cheat-sheet.md input.png
favicon: generating sizes
favicon: optimizing images with optipng
…
```

You can use this to make the instructions in your `README` executable,
for both users and automation:

```sh
$ tea ./README.md  # interprets `# Getting Started`
tea: npm install
tea: npm start

$ sh <(curl tea.xyz) https://github.com/my/project
tea: cloning…
tea: npm start

$ git clone https://github.com/my/project
$ cd project
$ tea build
tea: executing `# Build`
```

&nbsp;



## A Brief Diatribe

Every programming language, every build system, every compiler, web server,
database and email client seem to gravitate towards adding infinite features
and complexity so that their users can do ever more and more.

This is contrary to the UNIX philosophy: tools should do one thing and
—by being tight and focused—
do it *damn* well.
If they are composable and flexible then they can be combined,
piped and leveraged into a larger,
more capable toolbox.
*The Internet is built with this toolbox.*

Nowadays every programming language
reimplements the same set of libraries and tools because using a
well-maintained, mature and portable library that lives higher up the stack
adds too much complexity.
This extends the adolescence of new languages,
results in no single language even becoming truly state of the art
and leads to degrees of
duplication that make the open source ecosystem *fragile*.
This is to the detriment of all software, everywhere.

tea is designed to remove this complexity for development, for deployment *and
for scripting*.

&nbsp;


# Getting Started

Installing tea is easy:

```sh
sh <(curl https://tea.xyz)
# • only install files in `~/.tea`
# • makes you confirm you’re cool before it does that
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
curl’ing. And as soon as we enable cross platform support this one-liner
will work for everyone, everywhere.

## Now see here fella, I *hate* installers

We at tea know that feeling, what is the installer *doing to your system
exactly*? In fact tea is a single binary that you can download and run from
anywhere, so you can just download our latest [release](/releases) and run it
from your Downloads directory if you want.

> <details><summary><i>Installing Manually</i></summary><br>
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
> If this sourcery seems a bit much, you can just use tea as an interpreter instead.
> eg. `tea npm start` will execute the correct `npm` for your environment.
>
> </details>

> <details><summary><i>Uninstalling tea</i></summary><br>
>
> tea only installs to `~/.tea`
> There’s also a one-liner added to your `~/.zshrc` you should remove.
> </details>

&nbsp;


## Usage as an Environment Manager

You’re a developer, installing tools globally makes no sense. With tea the
tools you need per project or script are available to that workspace as
*virtual environments*. Our magic works from depths of libc to the heights of
the latests fads in CSS precompilers. All versions†. All platforms‡.

> † We’re new software, give us time to achieve this promise.\
> ‡ Windows, Raspberry Pi, BeOS, etc. coming soon!

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

For an example see our “[dependencies](#dependencies)” section
(teaception: we use tea to build tea).

You can check what environment this generates with `tea`:

```sh
tea --env --dump
```

`--env` specifies that tea will generate an environment based on the source
control checkout. So if you’re using git we’ll look around for a `.git`
directory and consider that the `SRCROOT` for your project. Then we check the
`README.md` there to gather the environment information.

tea attempts to further enhance your environment based on your workspace
context:

| Variable  | Description |
| --------- | ----------- |
| `VERSION` | Extracted from the `README` |
| `SRCROOT` | We descend towards root until we find a source control marker, eg. `.git` |
| `MANPATH` | So `man …` works for your deps |

We also provide eg. `PKG_CONFIG_PATH`, `LD_LIBRARY_PATH`, `DEVELOPER_DIR`,
etc. so other tools can find your dependencies. We provide other variables for
convenience too, like `GITHUB_SLUG` (extracted from your `git remote`) which
can be surprisingly useful to automation scripts.

~We also inject shell completions for your environment.~ *coming soon*

&nbsp;


## Usage as an Interpreter

You can use tea to execute pretty much any script from any location. We’ll
auto-magically install the right interpreter (as an isolated virtual
environment—there are no global consequences to your system).

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
#!/usr/bin/env tea

/* ---
tea:
  env: true   # †
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
tea: ~/.tea/deno.land/v1.18/bin/deno run \
  --allow-net \
  --import-map=/src/import-map.json \
  /src/script.ts \
  my-arg
```

> † specifying `env: true` is necessary to use `{{ srcroot }}` later in the
> YAML. You would also use it for any
> project that has an environment your scripts might need. Probably your
> project already specifies your `deno` dependency, so the above YAML is
> possibly being redundant.

&nbsp;


## Caveats

tea is **new software** and not mature. If you are an enterprise, we don’t
recommend using tea *yet*. If you are devshop or open source developer then
welcome! Dig in 🤝.

We only support macOS currently, though the Linux binary works pretty well.
Also, currently we require zsh.

We intend to be cross platform, this includes Windows (WSL **and** non-WSL),
Raspberry Pi, all varieties of Linux. Building binaries for everything we
support.

tea allows you to “get started” anywhere (*just not quite yet*).

&nbsp;


# Magic

tea uses the concept of magic. In an environment with magic we try to be
clever and infer what you want. Without magic we are strict and
require precise specification of your intent.

You can disable magic by specifying `--muggle` or exporting `MAGIC=0` to your
shell environment.

We do magic per dependency by processing a `magic.ts` in the [pantry]. For
example with `deno` we extract your `import-map` specification from any
`.vscode/settings.json` we find in your virtual environment. Then if you
type `deno` on the command line we automatically inject the import map. You
can supplement our magic by contributing to the [pantry].

&nbsp;


# Contributing

If you have suggestions or ideas, start a [discussion]. If we agree we’ll
move it to an issue. Bug fixes straight to pull request or issue please!

## Using A Local Checkout

When developing tea you often want to use that version as your primary tea
install. We provide a script to achieve this:

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

We install compartmentalized packages to `~/.tea`.

We then suggest you add our one-liner to your shell `.rc` and a symlink
for `/usr/local/bin/tea`.

## I thought you were decentralized and web3 and shit

tea is creating new technologies that will change how open source is funded.
tea/cli is an essential part of that endeavor and is released
prior to our protocol in order to bootstrap our holistic vision.

We don’t subscribe to any particular “web” at tea.xyz, our blockchain
component will be an implementation detail that you won’t need to think about
(but we think you will want to).

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
    > trust that if it comes to it, our users can fix things provided we give them a helping hand
* Be intuitive
    > being clever is good—but don’t be so clever nobody gets it
* Resist complexity
    > rethink the problem until a simpler solution emerges
* Be fast
    > we are in the way of our users’ real work, don’t make them wait

## Troubleshooting

### `env: tea: No such file or directory`

If you got this error message, you need to install tea:
`sh <(curl https://tea.xyz)`.


## Dependencies

|   Project   | Version |
|-------------|---------|
| deno.land   | ^1.27   |
| tea.xyz     | ^0      |



# Tea Scripts

## Test

```sh
export TMPDIR=${TMPDIR:-/tmp}

deno test \
 --allow-net \
 --allow-read \
 --allow-env=SRCROOT,GITHUB_TOKEN,TMPDIR,TEA_PREFIX \
 --allow-run \
 --import-map=$SRCROOT/import-map.json \
 --allow-write="$TMPDIR" \
 --unstable \
 $SRCROOT/tests/*.ts
```

## Typecheck

```sh
deno check --import-map="$SRCROOT"/import-map.json --unstable src/app.ts "$SRCROOT"/scripts/*.ts
```

## Run

```sh
deno run \
  --import-map="$SRCROOT"/import-map.json \
  --unstable \
  --allow-all \
  "$SRCROOT"/src/app.ts
```

## Compile

```sh
OUT="$1"
if test -z "$OUT"; then
  OUT="./tea"
else
  shift
fi

deno compile \
  --allow-read \
  --allow-write \
  --allow-net \
  --allow-run \
  --allow-env \
  --unstable \
  --import-map="$SRCROOT/import-map.json" \
  --output "$OUT" \
  "$@" \
  "$SRCROOT/src/app.ts"
```

## Install Self

```sh
tea compile "$TEA_PREFIX/tea.xyz/v$VERSION/bin/tea"
"$SRCROOT"/scripts/repair.ts tea.xyz
```


[pantry]: ../../../../pantry
[VSCode]: https://code.visualstudio.com
[Markdown]: https://daringfireball.net/projects/markdown/
[discussion]: ../../discussions
