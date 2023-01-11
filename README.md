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

Package managers suck. Why do you have to even have to think about
`brew install foo`? Isn’t managing packages mindless, tedious, busywork?

`tea`’s the last thing you’ll ever install:

```sh
sh <(curl tea.xyz)
```

&nbsp;


# tea/cli 0.19.0

```sh
$ node --eval 'console.log("Hello World!")'
command not found: node

$ sh <(curl tea.xyz) --yes
installing ~/.tea…

$ node --eval 'console.log("Hello World!")'
tea: installing nodejs.org^19
Hello World!
```

With tea there’s no *install packages step*. Just type the commands for what
you need and tea takes care of the rest.

We don’t even install the packages; we stow them in `~/.tea` so your system
remains untouched. The packages don’t even end up in your `PATH`:

```sh
$ which bun
bun not found

$ tea --dry-run bun --version
~/.tea/bun.sh/v0.4.0/bin/bun --version

$ bun --version
0.4.0
```

> Check out [# Magic](#Magic) to learn how this works.

It’s somewhat tedious also to have to manage your packages when running
scripts too. And let’s face it, this has held people back from writing scripts
in more useful languages than Bash. You just can’t rely on your team mates or
Internet randoms to have the dependencies you need installed.

```sh
$ tea ./hello.ts
installing deno…
deno: running hello.ts

$ tea https://gist.githubusercontent.com/i0bj/2b3afbe07a44179250474b5f36e7bd9b/raw/colors.go --yellow
tea: installing go 1.18.3
go: installing deps
go: running colors.go

# need more dependencies than the interpreter? tea reads YAML front matter!
$ tea ./favicon-generator input.png
tea: installing image-magick, optipng, guetzli and 3 other packages…
# …
output: favicon-128.png…

$ cat favicon-generator
#!/usr/bin/env ruby
# ^^ we read the shebang and automatically install ruby
#---
# dependencies:
#   imagemagick.org: 4
#   optipng.sourceforge.net: 1
#---
```

You’re a developer, you need specific versions of tools, not just whatever
the package manager happens to have today.

```sh
$ node^16 --version
tea: installing node^16
v16.19.0

$ node~16.18 --version
tea: installing node~16.18
v16.18.1

# when you need even more control we support the full semver.org spec
# though you will need to invoke tea directly
$ tea +nodejs.org>=15,<17 node --version
v16.19.0
```

In fact you can construct *virtual environments* of specific tools and
versions encapsulated and separate from the rest of your system.

```sh
$ tea +rust-lang.org^1.63 +python.org~3.11
tea: this is a temporary shell containing rust-lang.org, python.org and 13 other packages
tea: type `exit` when done

tea $ rustc --version
rustc 1.65.0

tea $ python --version
Python 3.11.1

tea $ exit
$
```

And since typically different projects will need different versions, we
support that too.

```sh
$ node --version
v19.3.0

$ cat <<EOF >>my-project/README.md
# Dependencies
| Project    | Version |
| ---------- | ------- |
| nodejs.org | ^18     |
EOF

$ cd my-project
$ node --version
v18.13.0

$ cd ..
$ node --version
v19.3.0
```

Encoding this data into the README makes use of tea completely optional:
tea can read it and *humans can too*. If the developer uses tea we make
working on the project effortless. If they don’t then they can source the
packages themselves.

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

&nbsp;


# Installing tea

tea is a standalone, cross-platform† binary. Grab it from [releases] or `curl`
it:

```sh
$ curl -Lo tea https://tea.xyz/$(uname)/$(uname -m)
$ chmod u+x ./tea

$ echo '# tea *really is* a standalone binary' | ./tea --sync glow -
tea: installing charm.sh/glow
# …
```

However, if you want tea’s shell [magic](#Magic), you’ll need our installer:

```sh
sh <(curl https://tea.xyz)
# • asks you to confirm before it sets up `~/.tea`
# • asks you to confirm before adding one line to your `~/.shellrc`
```

> † we support macOS >= 11 and Linux (glibc >= 23) and WSL, Windows native is
> being built *as we speak*.

<details><summary><code>`preview.gif`</code></summary>

![charm.sh/vhs recording](https://teaxyz.github.io/setup/sample.gif)

In fact, our one-liner *abstracts away installing tea itself*:

```sh
# will bun work with your node project? find out without having to install it!
$ sh <(curl tea.xyz) bun run start

# if tea is installed, our one-liner uses the tea installation, if it’s not
# installed then it **doesn’t install tea** or any dependencies, it creates a
# sandbox and runs everything in there

# ofc if tea is already installed you can just do:
$ tea https://examples.deno.land/color-logging.ts

# which really is expanded to this:
$ tea deno run https://examples.deno.land/color-logging.ts

# which *really*, really is expanded to this:
$ tea +deno.land deno run https://examples.deno.land/color-logging.ts

# if you want to know what tea will do then use `--dry-run` (or `-n`):
$ tea --dry-run https://examples.deno.land/color-logging.ts
~/.tea/deno.land/v1.29.1/bin/deno run https://examples.deno.land/color-logging.ts
```

> Now in your blog posts, tweets and tutorials you don’t have to start
> with any “how to install tea” preamble nor will they need to google anything.
> If they want to learn about tea first they can go to the same URL as they’re
> curl’ing. We already work on Linux, macOS, and WSL; soon we’ll support Windows
> natively.

As a bonus the installer also updates tea.

## *Now see here fella’, I \*hate\* installers…*

We feel you—there’s a reason *we wrote a package manager*.

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
> * Or here’s a fancy one-liner:
>
>   ```sh
>   $ sudo install -m 755 <(curl --compressed -LSsf https://tea.xyz/$(uname)/$(uname -m)) /usr/local/bin/tea
>   ```
>
> </details>

> <details><summary><i>Uninstalling tea</i></summary><br>
>
> Delete everything under `~/.tea`. Job done.
>
> > Well. Strictly there’s a (now harmless) one-liner in your shell’s
> > configuration file you may want to remove (eg `~/.zshrc`).
>
> </details>

&nbsp;



# Magic

Our magic puts the entire open source ecosystem at your fingertips.
Our installer enables it by adding some hooks to your shell:

* a hook when changing directory that sets up project environments
* a hook for the “command not found” scenario that installs that command

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

## What happened to executable markdown?

We may revisit executable markdown, but we realized that since tea makes it
so trivial to use anything from the open source ecosystem, it makes it trivial
for you as a developer to use `make` or [`just`](just.systems) or any of the
myriad of other tools that are tightly scoped to the initial goals of
executable markdown.

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
