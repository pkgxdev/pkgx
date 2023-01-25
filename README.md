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

Package managers are the foundation of every stack yet they haven’t evolved
in decades—*they still work the same way they always have*.

* Why are they so slow? So clunky? *So incapable*?
* Why do you need to use a different one (with subtly different syntax) on
    every platform?
* Why is it that you can have any version (*as long as its the latest*) but you
    have to to wait weeks for it?

Introducing `tea`, the next-generation, cross-platform package manager from
the creator of [`brew`].

&nbsp;


# tea/cli 0.21.2

```sh
$ node --eval 'console.log("Hello World!")'
command not found: node

$ sh <(curl tea.xyz) --yes
installing ~/.tea…

$ node --eval 'console.log("Hello World!")'
tea: installing nodejs.org^19
Hello World!
```

With tea there is no *install packages step*. Just type the commands you need
and tea takes care of the rest—fetching packages, constructing a virtual
environment isolated from the rest of your system and then running your
commands.

Change your thinking from “I want to *install* foo” to “I want to *use* foo”.

> Check out [# Magic](#magic) to learn how this works.

Scripting’s been stuck in a dark age of Bash because it’s the only thing you
can be sure is installed. Lame af right?

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

# when you need even more control we support the full https://semver.org spec
# though you will need to invoke tea directly
$ tea +nodejs.org'>=15,<17' node --version
v16.19.0
```

In fact you can construct *virtual environments* of specific tools and
versions encapsulated and separate from the rest of your system.

```sh
$ tea +rust-lang.org^1.63 +python.org~3.11 sh
tea: this is a temporary shell containing rust-lang.org, python.org and 13 other packages
tea: type `exit` when done

tea $ rustc --version
rustc 1.65.0

tea $ python --version
Python 3.11.1

tea $ which rustc
~/.tea/rust-lang.org/v1.65.0/bin/rustc
# ^^ inside environments tools *are* in `PATH`

tea $ exit

$ which rustc
rustc not found
# remember: tea doesn’t install packages
```

And since typically different projects will need different versions, we
support that too:

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

Encoding this data into the README makes use of tea *completely optional*
for your project.
tea can read it and *humans can too*. If the developer uses tea we make
working on the project effortless. If they don’t then they can source the
packages themselves.

&nbsp;


# Getting Started

tea is a standalone, cross-platform† binary. So if you wanted you could just
cURL it:

```sh
$ curl -Lo tea https://tea.xyz/$(uname)/$(uname -m)
$ chmod u+x ./tea

$ echo '# tea *really is* a standalone binary' | ./tea --sync glow -
tea: installing charm.sh/glow
# …
```

However, if you want tea’s shell [magic](#magic), you’ll need our installer:

```sh
sh <(curl https://tea.xyz)
# • asks you to confirm before it sets up `~/.tea`
# • asks you to confirm before adding one line to your `~/.shellrc`
```

> † we support macOS >= 11 and Linux (glibc >= 23) and WSL, Windows native is
> being built *as we speak*.

<details><summary><code>`preview.gif`</code></summary>

![charm.sh/vhs recording](https://teaxyz.github.io/setup/sample.gif)

</details>

In fact, our one-liner *abstracts away installing tea itself*:

```sh
# will your node project work with bun.sh? find out without having to install it!
$ sh <(curl tea.xyz) bun run start

# if tea is installed, our one-liner uses the tea installation, if it’s not
# installed then it **doesn’t install tea** or any dependencies, it creates a
# sandbox and runs everything in there
```

> Now in your blog posts, tweets and tutorials you don’t have to start
> with any “how to install tea” preamble nor will they need to google anything.
> If they want to learn about tea first they can go to the same URL as they’re
> curl’ing. We already work on Linux, macOS, and WSL; soon we’ll support Windows
> natively.

As a bonus the installer also updates tea.

## “Now see here fella’, I \*hate\* installers…”

It’s sad indeed that package managers can’t install themselves. Oh well.
How about installing with `brew` instead?

```sh
$ brew install teaxyz/pkgs/tea-cli
```

> <details><summary><i>Other ways to install tea</i></summary><br>
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

## GitHub Actions

```yaml
- uses: teaxyz/setup@v0
# ^^ https://github.com/teaxyz/setup
```

Our action installs your deps and make tea accessible to the rest of the
workflow.

&nbsp;


# Developer Environments

Every project you work on needs different tools with different versions.
Installing those tools globally *makes no sense* and could even cause subtle
bugs during dev.

tea can determine the tools a project directory needs and provide that
virtual environment. With our shell magic just step into the project directory
and type commands; tea automatically fetches the specific versions those
projects need and runs them.

If you need other tools or you want to be more specific about the version of
a tool then add your dependencies to your `README.md`. For an example see
the [# Dependencies] section for tea itself.

> * `package.json` means node, `cargo.toml` means rust, etc.
> * we can be a little cleverer: eg. if we detect that your project is a
>    GitHub Action we read the `action.yml` and make the right version of node
>    available.
> * if we’re missing your language then we’d love your PR!

There are all sorts of variables a developer needs when working on a project
and tea aims to make them available to you. Thus we provide `SRCROOT` and
`VERSION`‡ in addition to everything else required to make your devenv
function. To see the full environment for your project run `tea -En` or simply
`env`.

> ‡ extracted from the `README.md` or `VERSION` files.

> <details><summary><i>Umm… I hate this. Can I use a different file?</i></summary><br>
>
> We intend to support (safe) additions to all “package description” files.
> Currently we support a `tea` node in `package.json`. Please submit the PR
> for your language!
>
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

&nbsp;


# Magic

Our magic puts the entire open source ecosystem at your fingertips.
Our installer enables it by adding some hooks to your shell:

* A hook when changing directory that sets up project environments
* A hook for the “command not found” scenario that installs that command †

**Magic is entirely optional, tea is still entirely usable without it.** \
**Generally we’d say our magic is *for devs* and *not* for ops.**

> † Our “command not found” magic only works at a terminal prompt. Thus eg.
> VSCode won’t magically find `deno`. Shell scripts won’t automatically
> install tools they try to run. This is intentional. *Magic should not lead
> to anarchy*. See our [FAQ](#faq) for more information.

```sh
$ which bun
bun not found

$ tea --dry-run bun --version
imagined: bun.sh^0.4
~/.tea/bun.sh/v0.4.0/bin/bun --version

$ bun --version
tea: installing bun.sh^0.4
0.4.0

$ which bun
bun not found
# `bun` is not in your `PATH`
# ∵ tea doesn’t install packages
# ∴ using tea doesn’t compromise your system’s integrity

$ tea bun --version
0.4.0
# ^^ the same as `bun --version` but without magic
```

## Using `tea` Without Magic

Simply prefix everything with `tea`, eg. `tea npm start`.

## Using Developer Environments Without Magic

Simply prefix commands with `tea -E`, eg. `tea -E npm start`.

## Uninstalling `tea`’s Shell Magic

Our installer asked if you wanted magic when you ran it. If you elected to
install magic and no longer want it simply remove the one-liner from your
shell’s configuration file.

&nbsp;


# Packagers Who Care

You trust us to just work and make your workflows happen.
We take this job seriously and we go the extra mile on a per package basis
eg. our git ignores `.DS_Store` files by default and we insist our packages
are relocatable, which is why we can install in your home directory, but this
also means you could pick up the whole ~/.tea directory and bundle it with
your app. We also begin packaging new releases almost immediately as soon as
they go live using various automations.


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

deno task run foo   # runs the local checkout passing `foo` as an argument
deno task install   # deploys the local checkout into your `~/.tea`
```

## Contributing Packages

There’s hundreds of thousands of open source projects and we need your help
supporting them! Check out the docs for the [pantry] to learn more.

&nbsp;

&nbsp;



# Appendix

## FAQ

### How do I update?

```sh
$ tea --sync
# ^^ updates the pantries, and any packages in the virtual-environment

$ tea --sync +deno.land
# ^^ updates specific packages

$ sh <(curl tea.xyz) --sync
# ^^ updates `tea` as well
```

### How do I view what is stowed?

```sh
open $(tea --prefix)
```

We agree this is not great UX.

### I need a tool in `PATH` (aka `brew install`)

Symlinks† to `tea` automatically invoke their namesake:

```sh
$ ln -s $(which tea) /usr/local/bin/bun
$ bun --version
tea: installing bun…
bun 0.4.0

# you can version tools this way too
$ ln -s $(which tea) /usr/local/bin/bun~0.3
$ bun~0.3 --version
tea: installing bun=0.3.0
bun 0.3.0

# if you prefer you can symlink with a `tea+` or `tea_` prefix
$ ln -s $(which tea) /usr/local/bin/tea+node
$ tea+node --version
v19.3.0
```

> † this doesn’t work on Linux, you’ll need to use hard-links.
> this is a platform limitation we cannot work around 😞

### How do I use tea with editors like VSCode?

We intend to make a VSCode extension that automatically fetches the
environment for the active workspace. In the meantime add tools to your `PATH`
as described in the above FAQ.

### What are these `^`, `~`, etc. symbols?

tea adheres to [semantic versioning](https://semver.org).

### How do I find available packages?

We list all packages at [tea.xyz](https://tea.xyz/+/).
Or `open ~/.tea/tea.xyz/var/pantry`. We
agree this is not great UX.

### Will you support platform `foo`?

We want to support *all* platforms.
Start a [discussion] and let’s talk about how to move forward with that.

### What happened to executable markdown?

We may revisit executable markdown, but we realized that since tea makes it
so trivial to use anything from the open source ecosystem, it makes it trivial
for you as a developer to use [`xc`]†, `make` or [`just`] or any of the
myriad of other tools that are tightly scoped to the initial goals of
executable markdown.

> † xc actually *is* a more mature implementation of executable markdown and
> we think you should definitely check it out.

[`xc`]: https://github.com/joerdav/xc
[`just`]: https://just.systems

### How do I uninstall tea?

Delete everything under `~/.tea`. Job done.

> Well. Strictly there’s an (automatically deactivated) one-liner in your
> shell’s configuration file you may want to remove (eg `~/.zshrc`).

### I have another question

We have further FAQs in our [wiki](https://github.com/teaxyz/cli/wiki/FAQ).
Failing that Start a [discussion] and we’ll get back to you.

&nbsp;


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
`sh <(curl -Ssf https://tea.xyz)`.

## Dependencies

| Project   | Version |
| --------- | ------- |
| deno.land | ^1.27   |

> macOS >= 11 || linux:glibc >= 23 || WSL


[pantry]: https://github.com/teaxyz/pantry.core
[releases]: ../../releases
[deno]: https://deno.land
[TypeScript]: https://www.typescriptlang.org
[discussion]: https://github.com/orgs/teaxyz/discussions
[pantry.extra]: https://github.com/teaxyz/pantry.extra
[# Dependencies]: #dependencies
[`brew`]: https://brew.sh
