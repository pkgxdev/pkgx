![tea](https://tea.xyz/banner.png)

<p align="center">
  <a href="https://twitter.com/teaxyz">
    <img src="https://img.shields.io/badge/-teaxyz-2675f5?logo=twitter&logoColor=fff" alt="Twitter" />
  </a>
  <a href="https://discord.tea.xyz">
    <img src="https://img.shields.io/discord/906608167901876256?label=discord&color=1bcf6f&logo=discord&logoColor=fff" alt="Discord" />
  </a>
  <a href='https://coveralls.io/github/teaxyz/cli?branch=main'>
    <img src='https://coveralls.io/repos/github/teaxyz/cli/badge.svg?branch=main' alt='Coverage Status' />
  </a>
  <a href="https://docs.tea.xyz">
    <img src="https://img.shields.io/badge/-docs-2675f5?logoColor=fff&color=ff00ff&logo=gitbook" alt="Documentation & Manual" />
  </a>
</p>


# tea/cli 0.26.2

`tea` puts the whole open source ecosystem at your fingertips:

```sh
$ node
command not found: node

$ sh <(curl tea.xyz)
installing ~/.tea…

$ node
tea: installing ~/.tea/nodejs.org/v19.7.0 and 9 other pkgs…

Welcome to Node.js v19.7.0.
>
```

Nobody wakes up in the morning and thinks:

> I *can’t wait* to manage my packages today!

It’s *tedious*. It’s *busy work*.
With `tea` just type what you want and let us handle the rest.

&nbsp;

Scripting is powerful—*once you’ve done all that frustrating setup*. `tea`
abstracts away all the boring bits so you can focus on the fun stuff:

```sh
$ tea ./script.py
tea: installing ~/.tea/python.org/v3.11.1
# ^^ local scripts: nps

$ tea https://examples.deno.land/color-logging.ts
tea: installing ~/.tea/deno.land/v1.31.2
# ^^ remote scripts: also fine

$ tea ./favicon-generator input.png
tea: installing image-magick, optipng, guetzli and 3 other packages…
favicon-generator: favicon-128.png
# ^^ any package from anywhere: check

$ cat favicon-generator
#!/usr/bin/env ruby
# ^^ tea reads the shebang and automatically installs ruby
#---
# dependencies:
#   imagemagick.org: 4
#   optipng.sourceforge.net: 1
#---
# ^^ tea reads the YAML Front Matter and installs everything else too!
```

&nbsp;

You need *specific versions of tools* not just whatever the package manager
happens to have today.

```sh
$ node^16 --version
tea: installing node^16
v16.19.0
```

Projects require a range of tools and versions.
`tea` provides lightweight containers that we call “developer environments”:

```sh
$ rustc --version
tea: installing rust-lang.org
v1.68.0

$ echo <<EoYAML >> my-project/cargo.toml
#---
# dependencies:
#   rust-lang.org: ~1.67
#---
EoYAML

$ cd my-project
$ rustc --version
tea: installing ~/.tea/rust-lang.org/v1.67.1
v1.67.1
```

Every package has uniquely named project configuration files.
With other package managers pinning a version can be impossible but with
`tea` add some YAML Front Matter and we can fetch the specific version
you need (and anything else you might desire too).

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
> Frankly, tea is properly versioned (unlike system packagers) so with tea your
> deployments actually remain *more* stable.
> </details>

&nbsp;

The open source ecosystem is a treasure trove of tools and libraries but
trying new things out can be intimidating… Not any more:

```sh
$ tea +rust-lang.org sh
tea: this is a temporary shell containing rust-lang.org and 3 other pkgs
tea: type `exit` when done

tea $ rustc --version
rustc 1.65.0

tea $ exit

$ which rustc
command not found: rustc
```

`tea`’s `+pkg` syntax adds packages to an environment and then executes commands
within it. This can make trying out seemingly complex projects trivial, eg.
setting up your environment for the [stable-diffusion-webui] project can be
quite tricky, but not so with `tea`:

```sh
$ git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui
$ tea \
  --cd stable-diffusion-webui \
  +python.org~3.10 +pip.pypa.io +gnu.org/wget +protobuf.dev +rust-lang.org \
  ./webui.sh
```

&nbsp;



# Getting Started

tea is a standalone, cross-platform binary ([releases]);
all the same we recommend our installer:

```sh
sh <(curl https://tea.xyz)
```

Our one-liner sets up in `~/.tea` and enables magic but it actually can do a
whole bunch more. For all the deets and other ways to install (including [our
GitHub Action]) check out the manual [docs.tea.xyz].

&nbsp;



# Documentation & Manual

You want all the docs? We got all the docs. [docs.tea.xyz]

&nbsp;



# Support

We appreciate your using `tea` and would love to help you solve any problems
you may be having.

* [github.com/orgs/teaxyz/discussions](https://github.com/orgs/teaxyz/discussions)
* [discord.tea.xyz](https://discord.tea.xyz)

&nbsp;



# Adding New Packages

Check out the [pantry README].


# Contributing to tea/cli

If you have suggestions or ideas, start a [discussion].
If we agree, we’ll move it to an issue.
Bug fixes straight to pull request or issue please!

## Hacking on tea/cli

`tea` is written in [TypeScript] using [deno].

```sh
$ git clone https://github.com/teaxyz/cli tea
$ cd tea

deno task run foo
# ^^ runs the local checkout passing `foo` as an argument
# NOTE this doesn't currently work due to a bug in Deno :(
# see denoland/deno#11547 and denoland/deno#18631

$ deno task install
# ^^ deploys the local checkout into your `~/.tea`

$ deno task compile && ./tea
```


[docs.tea.xyz]: https://docs.tea.xyz
[pantry]: https://github.com/teaxyz/pantry
[deno]: https://deno.land
[TypeScript]: https://www.typescriptlang.org
[discussion]: https://github.com/orgs/teaxyz/discussions
[stable-diffusion-webui]: https://github.com/AUTOMATIC1111/stable-diffusion-webui
[releases]: ../../releases
[our GitHub Action]: https://github.com/teaxyz/setup
[pantry README]: https://github.com/teaxyz/pantry#contributing
