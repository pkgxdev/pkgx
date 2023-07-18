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


# tea/cli 0.38.3

`tea` is [`npx`] for *everything*.

```sh
$ node
command not found: node

$ brew install teaxyz/pkgs/tea-cli
# …

$ tea node --version
v19.7.0

$ node
command not found: node
# ^^ tea is not a package manager; keep installing shit w/`brew`
```

[`npx`]: https://www.npmjs.com/package/npx

&nbsp;



`tea` is [`nvm`] for *everything*:

```sh
$ cd my-project

$ cat .node-version
16

$ tea --env node --version
v16.20.1

$ source <(tea -E)
# temporarily adds `my-project`’s deps to your current shell

$ node --version
v16.20.1

$ which node
~/.tea/nodejs.org/v16.20.1/bin/node
# ^^ everything goes in ~/.tea

# use any version of anything
$ tea node@19 --version
v19.7.0

# we package as far back as we can
$ tea python=2.7.18 --version
Python 2.7.18
```

> this works for every dev-ecosystem, not just node, eg. we read
> `pyproject.toml`, `.ruby-version`, etc.

[`nvm`]: https://github.com/nvm-sh/nvm

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



`tea` knows how to interpret *anything*:

```sh
$ tea ./script.py
tea: installing ~/.tea/python.org/v3.11.1
# ^^ local scripts: nps

$ tea https://examples.deno.land/color-logging.ts
tea: installing ~/.tea/deno.land/v1.31.2
# ^^ remote scripts: also fine
```

Go further; tap the entire open source ecosystem via YAML front matter:

```sh
$ cat favicon-generator.sh
#!/usr/bin/ruby
# ^^ tea reads the shebang and automatically installs ruby
#---
# dependencies:
#   imagemagick.org: 4
#   optipng.sourceforge.net: 1
#---
# …

$ tea favicon-generator.sh input.png
tea: installing image-magick, optipng, guetzli and 3 other packages…

$ file *.png
favicon-128.png: PNG image data, 128 x 128
favicon-32.png: …
```

Setting the shebang to `#!/usr/bin/env -S tea node` is also fine.

&nbsp;



Try out anything open source offers in an encapsulated sandbox:

```sh
$ tea +rust-lang.org sh
tea: this is a temporary shell containing rust-lang.org and 3 other pkgs
tea: type `exit` when done

tea $ rustc --version
rustc 1.65.0

tea $ exit

$ rustc
command not found: rustc
```

`tea`’s `+pkg` syntax adds packages to an environment and then executes
commands within it. This can make trying out seemingly complex projects
trivial, eg. setting up your environment for the [stable-diffusion-webui]
project can be quite tricky, but not so with `tea`:

```sh
$ git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui
$ tea \
  --cd stable-diffusion-webui \
  +python.org~3.10 +pip.pypa.io +gnu.org/wget +protobuf.dev +rust-lang.org \
  ./webui.sh
```

&nbsp;



If you’re cool and you love cool stuff then `tea` can optionally make command
not found errors a thing of the past:

```sh
$ which node
command not found: node

$ source <(tea --magic)

$ node --version
tea: installing nodejs.org…
v19

$ node@16 --version
v16

$ node --version
v19   # the most recent is default
```

Our magic also loads project deps into the environment when you step inside:

```sh
$ cd my-project

my-project $ cat .node-version
14

my-project $ node --version
tea: installing nodejs.org@14…
v14

my-project $ cd ..

$ node --version
v19

$ source <(tea --magic=unload)

$ node
command not found: node
```

&nbsp;



# Getting Started

```sh
brew install teaxyz/pkgs/tea-cli
```

If you prefer, tea is a standalone, cross-platform binary that you can install
anywhere you want ([releases]). Here’s a handy one-liner:

```sh
sudo install -m 755 \
  <(curl --compressed -LSsf https://tea.xyz/$(uname)/$(uname -m)) \
  /usr/local/bin/tea
```

## Setting up Magic

By itself tea works well, it’s just a little manual, but we’re all magic
addicts and recommend it:

```sh
echo 'source <(tea --magic)' >> ~/.zshrc
```

With magic stepping into directories ensures the packages those projects need
are installed on demand and available to the tools you’re using.

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

$ deno task install
# ^^ deploys the local checkout into your `~/.tea`

$ deno task compile && ./tea
```


[docs.tea.xyz]: https://docs.tea.xyz
[docs.tea.xyz/getting-started]: https://docs.tea.xyz/getting-started/install-tea
[deno]: https://deno.land
[TypeScript]: https://www.typescriptlang.org
[discussion]: https://github.com/orgs/teaxyz/discussions
[stable-diffusion-webui]: https://github.com/AUTOMATIC1111/stable-diffusion-webui
[releases]: ../../releases
[our GitHub Action]: https://github.com/teaxyz/setup
[pantry README]: https://github.com/teaxyz/pantry#contributing
