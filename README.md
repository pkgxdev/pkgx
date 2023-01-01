![tea](https://tea.xyz/banner.png)

<p align="center">
  <a href="https://twitter.com/teaxyz">
    <img src="https://img.shields.io/twitter/follow/teaxyz?style=flat&label=%40teaxyz&logo=twitter&color=2675f5&logoColor=fff" alt="Twitter" />
  </a>
  <a href="https://discord.gg/JKzuqrW9">
    <img src="https://img.shields.io/discord/906608167901876256?label=discord&color=29f746" alt="Discord" />
  </a>
  <a href="#">
    <img src="https://img.shields.io/github/v/release/teaxyz/cli?label=tea/cli&color=ff00ff" alt="Version" />
  </a>
</p>

tea is not a package manager.

*tea is unified packaging infrastructure*.

From the creator of [`brew`], tea is a standalone, binary download for all
platforms that puts the entire open
source ecosystem at your fingertips. Casually and effortlessly use the latest
and greatest or the oldest and most mature from any layer of any stack. Break
down the silos between programming communities, throw together scripts that
use entirely separate tools and languages and share them with the world with
a simple one-liner.

All you need is `tea`.

&nbsp;

> tea is pre v1. This means there may still be some rough edges in day to day use.
> It also means that you should absolutely get involved. This is the key and
> golden time when getting involved is both easy and hugely fun. We look
> forward to meeting you 👊

&nbsp;


# tea/cli 0.17.3

Open source is a treasure trove—yet those chests are sealed with gnarly locks.
tea is the key:

```sh
$ tea +rust-lang.org

tea: installing rust-lang.org and 13 other packages into a temporary sandbox
when done type: exit

tea $ cat <<EOF >hello.rs
fn main() {
  println!("Hello World!");
}
EOF
$ rustc hello.rs -o hello
$ ./hello
Hello World!

tea $ exit

$ rustc
command not found: rustc
```

tea doesn’t *install* packages—at least not in a conventional sense—we *stow*
them in `~/.tea`†. Your system remains pristine and isolated from tea’s
activity. But everything is right there when you need it.

> † *finally* a package manager where all the packages are *relocatable* (like
> they should be).

### tea Pipelines

tea’s `+pkg` syntax puts the whole open source ecosystem at your fingertips,
if you stop at the `+pkg` then the above happens—we open a new shell with those
packages in the environment—but if you keep typing you can construct direct
usage:

```sh
$ tea +nodejs.org npx --yes browser-sync start --server
# ^^ one-liner to start a local web server with live reload

$ sh <(curl tea.xyz) +nodejs.org npx --yes browser-sync start --server
# ^^ same one-liner but works for anyone on the Internet
# (if tea is already installed, it uses it, if not it *doesn’t* install tea,
#  a temporary sandbox is created)
```

Compose everything, combine everything—just like the UNIX philosophy
envisaged. Which leads us to `tea`-pipelines:

```sh
$ tea +gnu.org/wget wget -qO- tea.xyz/white-paper | tea +charm.sh/glow glow -
```

This example downloads our white paper and renders it with [charm]’s excellent
`glow` terminal markdown renderer. This is a basic example, but UNIX has been
limited by the package manager for **too long**. It’s a fundamental limitation
that tea is designed to overcome.

> Notably, with `-X` syntax this can be expressed more concisely:
>
> ```sh
> $ tea -X wget -qO- tea.xyz/white-paper | tea -X glow -
> ```

> <details><summary><h3>Further Examples</h3></summary>
>
> It’s 202x so obviously we also can download scripts from the Internet:
>
> ```sh
> $ sh <(curl tea.xyz) +charm.sh/gum https://github.com/charmbracelet/gum/blob/main/examples/demo.sh
> ```
>
> Want to try out the latest version of node, but not sure if it will work
> with your project? *tea makes it easy.*
>
> ```sh
> $ tea +nodejs.org^19 npm start
> ```
>
> One liner to create a react app:
>
> ```sh
> $ sh <(curl tea.xyz) -X npx create-react-app my-app
> ```
>
> </details>

> ### Coming Soon
>
> tea pipelines are so interesting we intend to have a dedicated showcase for
> them.

&nbsp;


## tea: the Universal Interpreter

```sh
$ tea https://gist.githubusercontent.com/i0bj/2b3afbe07a44179250474b5f36e7bd9b/raw/colors.go --yellow
tea: installing go 1.18.3
go: installing deps
go: running colors.go
…
```

In this basic example we know to install `go` first based on the file
extension. Obvious right? Which is why we didn’t stop there:

```sh
$ tea favicon-generator.sh input.png
tea: installing image-magick, optipng, guetzli and 3 other packages…
…
output: favicon-128.png…

$ cat favicon-generator.sh
#!/usr/bin/env tea
#---
# args: [/bin/sh, -e]
# dependencies:
#     imagemagick.org: 4
#     optipng.sourceforge.net: 1
#---

[snip…]
```

tea reads a file’s YAML front-matter, allowing you to roll in the
entire open source ecosystem for your scripts, gists and one-liners. While it
runs, the script has these dependencies in its environment, but the rest of
your system will never know about them.

We also know a little more magic:

```sh
$ tea -X node
tea: installing node@18.9.1
Welcome to Node.js v18.9.1.
Type ".help" for more information.
>
```

Typically `tea` uses fully-qualified-names for packages, but we know what
tools they provide, so as long as you know what tool you’re looking for we can
figure out the rest.

Notably if you create a symlink of `foo` to `tea` (or `tea_foo`) we will
interpret that as `tea -X foo [args…]`, yet another way using `tea` can be
completely transparent to your everyday workflows.

Even better, you can include semver ranges in your link name, so `ln -s tea node^16`
will let you run `node^16` via the symlink of the same name. For even, even more
goodness, we will follow a symlink one deep to see if a base link goes to a versioned
link. Example:

```sh
$ ln -s tea node^16
$ ln -s node node^16
$ node --version
v16.19.0
```

> ### Coming Soon
>
> ```yaml
> ---
> dependencies:
>  nodejs.org: 19
>  npmjs.com:
>    package.json:
>      dependencies:
>        react: ^18
> ---
> ```

&nbsp;


## tea: the universal virtual‑environment manager

```sh
$ deno
zsh: command not found: deno

$ echo $PATH
/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin

$ cd my-project
$ deno
tea: installing deno.land^1.22
deno 1.27.0
> ^D

$ env
PATH=~/.tea/deno.land/v1.27.0/bin:/usr/bin:/bin
SRCROOT=/src/my-project
VERSION=…
…
```

> <details><summary><i>What is this sourcery?</i></summary><br>
>
> tea uses a shell hook to insert the precise tooling your project needs into
> your shell environment. Development is now containerized at the
> *package manager* level. No longer do you need to worry about your team
> being on different versions of foundational tooling nor do you need to worry
> about system level updates breaking different projects you’re working on.
>
> There are thousands of version managers for the thousands of tools they
> support. Probably it’s time we stopped that duplicated effort.
>
> Projects can specify precisely what they need and you can install those
> requirements precisely be it today, tomorrow or in ten years.
>
> In the above example if `deno` is not yet installed we insert a hook so
> trying to execute it will install it first.
> </details>

> <details><summary><i>PSA:</i> Stop using Docker</summary><br>
>
> Docker is great for deployment and cross compilation, but… let’s face it: it
> sucks for dev.
>
> *Docker stifles builders*.
> It constricts you; you’re immalleable; tech marches onwards but your docker
> container remains immobile. *Nobody knows how to use `docker`*. Once that
> `Dockerfile` is set up, nobody dares touch it.
>
> And let’s face it, getting your personal dev and debug tools working inside
> that image is incredibly frustrating. Why limit your potential?
>
> Keep deploying with Docker, but use tea to develop.
>
> Then when you do deploy you may as well install those deps with tea.
>
> Frankly, tea is properly versioned unlike system packagers, so with tea your
> deployments actually remain *more* stable.
> </details>

You need 34 dependencies to compile our white-paper but with tea there’s
nothing to think about:

```sh
$ git clone https://github.com/teaxyz/white-paper
$ cd white-paper
$ tea make  #†
tea: installing pandoc.org and 33 other dependencies…
…
$ open tea.white-paper.pdf
```

Our white-paper’s dependencies are written in plain markdown in our `README`.
tea sets up a virtual environment for them simply by stepping into the
directory.

> † prefixing with tea ensures all the deps get installed before `make` is run
> in general tea is a *shell* that injects a packaging environment before
> executing other commands.

> ### Coming Soon
>
> * we’ll automatically load and unload completions as you change directory
> * we’ll allow customizations per package for your project

&nbsp;


## Executable Markdown

[Markdown] has (justifiably) become the standard documentation format of
development. How about instead of writing scripts with comments, we write
documentation that can be *run*.

```sh
$ tea .  # interprets `# Getting Started`, could also be `tea ./README.md`
tea: npm install
tea: npm start

$ git clone https://github.com/my/project
$ cd project
$ tea build
tea: executing `# Build`
```

Using these scripts in CI is easy:

```yaml
steps:
  - uses: teaxyz/setup@v0
    with:
      target: build
```

Check out [teaxyz/setup] for all that you can do with our GitHub Action.

> ### Coming Soon
>
> This is a limited set of first steps exploring the idea of executable
> markdown. We intend to sensibly build out concepts for making entire
> documents executable, and we’d like your help with that.
> Start a [discussion] about it.

&nbsp;



# Getting Started

tea is a standalone binary. Grab it from [releases] or `curl` it:

```sh
$ curl -Lo tea https://tea.xyz/$(uname)/$(uname -m)
$ chmod u+x ./tea

$ echo '# tea *really is* a standalone binary' | ./tea -X glow -
```

However, we recommend our installer:

```sh
sh <(curl https://tea.xyz)
# • asks you to confirm before it sets up `~/.tea`
# • asks you to confirm before adding one line to your `~/.shellrc`
# • asks you to confirm before making a `/usr/local/bin/tea` symlink
```

<details><summary><code>`preview.gif`</code></summary>

![charm.sh/vhs recording](https://teaxyz.github.io/setup/sample.gif)

</details>

<details><summary>If you <code>fish</code>, read this…</summary>

```fish
sh <(curl https://tea.xyz | psub)
```

</details>

In fact, the tea one-liner abstracts away installation:

```sh
$ sh <(curl tea.xyz) https://examples.deno.land/color-logging.ts

# if tea is installed, our one-liner uses the tea installation, if it’s not
# installed then it **doesn’t install tea** or any dependencies, it creates a
# sandbox and runs everything in there

# and btw, the above works the same as:
$ tea https://examples.deno.land/color-logging.ts

# which really is:
$ tea -X deno run https://examples.deno.land/color-logging.ts

# which *really*, really is:
$ tea +deno.land deno run https://examples.deno.land/color-logging.ts
```

> Now in your blog posts, tweets and tutorials you don’t have to start
> with any “how to install tea” preamble nor will they need to google anything.
> If they want to learn about tea first they can go to the same URL as they’re
> curl’ing. We already work on Linux, macOS, and WSL; soon we’ll support Windows
> natively.

As a bonus the installer also updates tea.

## *Now see here fella’, I \*hate\* installers…*

Us too! *That’s why we wrote a package manager!*

> <details><summary><i>Installing without the installer</i></summary><br>
>
> Take your pick:
>
> * Grab the latest [release][releases] with your browser. On macOS you’ll
>   have to unquarantine the binary:
>
>   ```sh
>   $ xattr -d com.apple.quarantine ./tea
>   ```
>
> * Or get a plain text listing of binary downloads:
>
>   ```sh
>   $ curl dist.tea.xyz   # pick your platform and `curl` it
>   ```
>
> * Or if you want to get fancy there’s this:
>
>   ```sh
>   $ sudo install -m 755 <(curl --compressed -LSsf https://tea.xyz/$(uname)/$(uname -m)) /usr/local/bin/tea
>   ```
>
> Our (optional) virtual environment manager functionality needs a shell hook
> in the relevant `.rc` file:
>
> ```sh
> add-zsh-hook -Uz chpwd(){ source <(tea -Eds) }
> ```
>
> </details>

> <details><summary><i>Uninstalling tea</i></summary><br>
>
> * You can delete everything under `~/.tea`
> * There’s also a one-liner added to your `~/.zshrc` you should remove.
> * Finally delete `/usr/local/bin/tea`
>
> </details>

&nbsp;


## Usage as an Environment Manager

You’re a developer, installing tools globally makes no sense. With tea the
tools you need per project or script are available to that workspace as
*virtual environments*. Our magic works from depths of libc to the heights of
the latests fads in CSS precompilers. All versions†. All platforms‡.

> † We’re new software, give us time to achieve this promise.\
> ‡ Windows (native, we support WSL), Raspberry Pi, BeOS, etc. coming soon!

When you `cd` into a project in your terminal, tea sets up the environment so
your tools “just work”. To do this it looks for a dependencies table in
your `README`.

> Using the `README` may seem weird, but really it's the right place to
> document your dependencies. Typically in open source this information is
> barely documented, incorrectly documented or duplicated (incorrectly) in
> various hard to find places. No longer.
>
> Additionally this makes use of tea *optional*. Your team or your users can
> source your dependencies themselves if they want. It says right there in a
> human readable form in the `README` what they need to get.
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
> `package.json` by disabling magic with `--disable-magic`.
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

| Variable  | Description                                                               |
| --------- | ------------------------------------------------------------------------- |
| `VERSION` | Extracted from the `README.md`, `VERSION` or `package.json`               |
| `SRCROOT` | We descend towards root until we find a source control marker, eg. `.git` |
| `MANPATH` | So `man …` works for your deps                                            |

We also provide eg. `PKG_CONFIG_PATH`, `LD_LIBRARY_PATH`, `DEVELOPER_DIR`,
etc. so other tools can find your dependencies. We provide other variables for
convenience too, like `GITHUB_SLUG` (extracted from your `git remote`) which
can be surprisingly useful to automation scripts.

These variables are also available to “tea Scripts”.

> Our shell magic controls this feature, if you don’t want to add our
> one-liner to your shell rc then you can just `tea sh` in your project
> directory to get the same effect—albeit more laboriously.
>
> Or you can run tools directly with eg. `tea foo`

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
  python.org: ^3.11
---
"""

# snip …
```

tea will run the script with the latest version of Python that is >=3.11 but
less than 4.0. If it's not installed we grab it, otherwise we use what is
available.

We also support `args` and `env` parameters which are useful for tools that
require a `run` command like deno or go.

```ts
#!/usr/bin/env deno

/*---
dependencies:
  deno.land: ^1.27
args:
  - deno
  - run
  # we put the script filename on the end for you here
env:
  foo: {{srcroot}}/bar
---*/
```

> Note strictly you don’t need the above, we automatically do this (if magic
> is enabled) for `.ts` scripts.

### Using a `tea` Shebang

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
  # ^^ we provide {{srcroot}} which can be enormously useful for scripting
  # note that you must use a `tea -E` shebang for this to work
--- */

// snip …
```

Which would go like this:

```sh
$ pwd
/src
$ ./script.ts my-arg
tea: ~/.tea/deno.land/v1.18/bin/deno run \
  --allow-net \
  --import-map=/src/import-map.json \
  /src/script.ts \
  my-arg
```

> When called with `-E` tea reads the virtual environment and injects any
> dependencies from there. Probably your project already specifies your `deno`
> dependency, so the above YAML is possibly being redundant.

&nbsp;


# Magic

`tea` formalizes (in a CLI/TUI sense) the concept of magic.

In an environment where there
is magic we try to be clever and infer what you want. Without magic we are
strict and require precise specification of your intent.

You can disable magic by specifying `--disable-magic` or exporting `MAGIC=0`
to your shell environment.

The primary magic we apply is determining if you want to use your virtual
environment or not. Strictly `tea --env` is required to inject it, but when
magic is enabled we try to figure out if you *just wanted that*. Our goal is
to be smart and useful for your productivity.

We do some magic per dependency. This is currently hard-coded logic in tea/cli
itself, but we intend to make it general with a `magic.ts` file per package
in the [pantry].

Currently magic is limited (and a great place for contributions†).

For example, if we detect that your project is a GitHub Action we read the
`action.yml` and make the right version of node available.

> † is there a file that your environment or language always has and thus
> `tea` should know to add packages to that environment? Open a [discussion]
> or just go straight to contributing the PR!
> Magic lives in `useVirtualEnv.ts`.

&nbsp;


# Contributing

If you have suggestions or ideas, start a [discussion]. If we agree we’ll
move it to an issue. Bug fixes straight to pull request or issue please!

Probably the place you’ll want to start is by supplementing the
[pantry][pantry.extra].

## Hacking on `tea`

`tea` is written in [TypeScript] using [deno].

```sh
git clone https://github.com/teaxyz/cli tea
cd tea

tea run foo       # runs the local checkout passing `foo` as an argument
tea install-self  # deploys the local checkout into your `~/.tea`
```

This alias makes it so you can execute your local checkout from anywhere:

```sh
alias teal="$HOME/.tea/deno.land/v1/bin/deno run \
  --import-map=$HOME/tea/cli/import-map.json \
  --unstable \
  --allow-all \
  $HOME/tea/cli/src/app.ts"

# ^^ change the paths!
# ^^ add to your `~/.shellrc` file
```

### Things we Need

* We really need more tests!
* We need test coverage information
* More magic for dependencies, eg. knowing what version of node should be in
    the env based on `.node-version` files used for other version managers.

## Token Rewards

There isn’t a token *yet* but when it’s brewed it’s quite possible there will
be a little something extra for those who helped build tea. 😶‍🌫️

&nbsp;


# FAQ

## How do I update packages

```sh
$ tea --sync
# ^^ updates the pantries, and any packages in the virtual-environment

$ tea --sync +deno.land
# ^^ updates specific packages
```

Of course this is limited and more is required here. We’re working on it.

## Where’s `tea install`?

tea works differently. It’s not “I want to install Freetype” it’s
“I want to *use* Freetype”.

Look, we’re not idiots. We know there are occasions where a good ol’
`brew install` is what you need. So—*for now*—continue using `brew install`.
Longer term, we have plans for an extensible commands system.

*tea is a set of packaging primitives*. We want you to build entirely new
things on top of tea. We want to integrate tea into your existing build tools,
we eventually want to be the authoritative packaging datastore (isn’t it about
time there was one of those?)

Coming soon is [tea/cmd]. tea/cli will expose forks of this repo as commands
the user can run utilizing the power of tea’s packaging primitives to do all
that they can imagine. Maybe it’ll be you who writes the `tea install`
command? (If you do, try to do something new, eh? 😌)

### May we interest you in a hack?

If you really want to put `tea` through its paces, you can combine the search
magic with your shell’s “command not found” logic, to get automatic `tea`
lookups.

> <details open><summary><h4><code>zsh</code></h4></summary>
>
> ```sh
> function command_not_found_handler {
>   tea -X $*
> }
> ```
>
> </details>

> <details><summary><h4><code>bash</code></h4></summary>
>
> The following requires `bash^4`; sadly macOS ships with v3.2, but `tea`
> provides `+gnu.org/bash`, and we’ve met very few people who want to use
> `bash` on macs, though I bet you're out there).
>
> ```sh
> function command_not_found_handle {
>   tea -X $*
> }
> ```
>
> </details>

> <details><summary><h4><code>fish</code></h4></summary>
>
> ```sh
> function fish_command_not_found
>   tea -X $argv
> end
> ```
>
> </details>

## How do I find available packages?

We list all packages at [tea.xyz](https://tea.xyz/+/).
Or `open ~/.tea/tea.xyz/var/pantry`. We
agree this is not great UX.

## What are you doing to my computer?

We install compartmentalized packages to `~/.tea`.

We then suggest you add our one-liner to your shell `.rc` and a symlink
for `/usr/local/bin/tea`.

We might not have installed tea, if you used `sh <(curl tea.xyz) foo` and tea
wasn’t already installed, then we only fetched any packages, including
tea, temporarily.

## I thought you were decentralized and web3 and shit

[tea is creating new technologies that will change how open source is funded][white-paper].
tea/cli is an essential part of that endeavor and is released
prior to our protocol in order to bootstrap our holistic vision.

We don’t subscribe to any particular “web” at tea.xyz, our blockchain
component will be an implementation detail that you won’t need to think about
(but we think you will want to).

## Am I or my employer going to have to pay for open source now?

No. Software is a multi-trillion industry. We only have to skim a little off
that to pay the entire open source ecosystem. Check out our [white-paper] for
the deets.

## Packaging up tea packages with your `.app`, etc.

Our packages are relocatable by default. Just keep the directory structure the
same. And ofc. you are licensed to do so (by us! each package has its own
license!). Honestly we think you should
absolutely bundle and deploy tea’s prefix with your software. We designed it
so that it would be easier for you to do this than anything that has come
before.

## Will you support platform `foo`

We want to support *all* platforms.
Start a [discussion] and let’s talk about how to move forward with that.

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
    > trust that if it comes to it, our users can fix things provided we give
    > them a helping hand
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

## vs. `brew`

We don’t aim to replace `brew`, we see our offerings as somewhat
complementary. Still where we have overlapping features:

* tea supports more platforms
* tea is transparently cross-platform in usage
* tea packages are relocatable
* tea aims to be zippy and stay zippy
* tea doesn’t make global changes to your system
* tea doesn’t require you install the Xcode Command Line Tools
* tea aims to enhance the way you work, rather than dictate the way you work
* tea installs independently for every user on the machine
* tea is somewhat decentralized and aims to be completely decentralized
* tea is a handful of tight, easy-to-understand codebases
* tea starts building new releases for tools almost instantly
* tea’s packages are named in a fully-qualified manner
* tea’s philosophy is user-first and not tea-maintainer-first


&nbsp;

## Tea Scripts

You can execute each of these with `tea foo` where `foo` is the name of the
section.

### Test

> `FIXME` would be nice to be able to specify tests here
> deno supports `--filter` but that would require a little
> massaging.

```sh
deno task test
```

### Typecheck

```sh
deno task typecheck
```

### Run

```sh
deno task run
```

### Compile

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

### Install Self

Installs this working copy into `~/.tea/tea.xyz/vx.y.z`.

```sh
tea compile "$TEA_PREFIX/tea.xyz/v$VERSION/bin/tea"
"$SRCROOT"/scripts/repair.ts tea.xyz
```

## Dependencies

| Project   | Version |
| --------- | ------- |
| deno.land | ^1.27   |
| tea.xyz   | ^0      |

> macOS >= 11 || linux:glibc >= 23


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

tea removes this complexity and adds some much needed robustness for the good
of the entire open source ecosystem, the larger Internet and the whole world
of software.


[pantry]: https://github.com/teaxyz/pantry.core
[Markdown]: https://daringfireball.net/projects/markdown/
[releases]: ../../releases
[teaxyz/setup]: https://github.com/teaxyz/setup
[deno]: https://deno.land
[tea/cmd]: https://github.com/teaxyz/cmd
[TypeScript]: https://www.typescriptlang.org
[discussion]: https://github.com/orgs/teaxyz/discussions
[white-paper]: https://github.com/teaxyz/white-paper
[`brew`]: https://brew.sh
[charm]: https://charm.sh
[pantry.extra]: https://github.com/teaxyz/pantry.extra
