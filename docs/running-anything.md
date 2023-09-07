# `tea`—pkg runner

Run anything:

```sh
$ tea openai --version
openai 0.27.8
```

{% hint style="success" %}
Command not found? Command no problem.

```sh
$ deno run https://example.com/hello-world.ts
^^ type `tea` to run that

$ tea
tea +deno && deno run https://example.com/hello-world.ts
deno: hello, world!

$ deno --version
deno 1.36.1
# ^^ deno is added to the environment for the session duration
```
{% endhint %}

{% hint style="tip" %}
We provide the alias `t` so this workflow can be as quick and convenient
as possible:

```sh
$ npx kill-port 8080
# ^^ type `tea` to run that

$ t
tea +npx && npx kill-port 8080
```
{% endhint %}


## Run Any Version

```sh
$ tea postgres@12 --version
postgres (PostgreSQL) 12.14
```

{% hint style="info" %}

Generally you probably want `@` syntax, but if you need more specificity we
fully support [SemVer]:

```sh
$ tea postgres^12 --version
postgres (PostgreSQL) 12.14

$ tea "postgres>=12<14" --version
postgres (PostgreSQL) 13.11

$ tea deno=1.35.3 --version
deno 1.35.3
```
{% endhint %}

### Running the Latest Version

`tea foo` runs the latest “foo” that **is installed**.

If you want to ensure the latest version of foo is installed, use
`tea foo@latest`.

{% hint style="info" %}

Specify `tea@latest` to ensure you have the latest `tea` installed.

```sh
$ tea@latest npx@latest cowsay@latest 'fancy a cuppa?'
 ________________
< fancy a cuppa? >
 ----------------
        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||
```

The newer tea is installed to `~/.tea` like every other pkg. If your `tea` is
installed to `/usr/local/bin` then it will proxy forward to the newest version
installed automatically; you don’t need to upgrade it.

{% endhint %}


## Endpoints

Some packages provide typical usages via an `endpoint` entry in their [pantry]
entry and can be started via `tea run`.

These are often used to do the equivalent of a project’s getting
started steps. For example `tea run llama.cpp` downloads the model and launches a
chat interface and `tea run stable-diffusion-webui` launches the web-ui.


## Adding Additional Packages to the Execution Environment

With our shellcode `tea +openssl` adds OpenSSL to the shell environment.
When using `tea` as a runner you can add additional packages to the execution
environment with the same syntax:

```sh
$ tea +openssl cargo build
tea: added ~/.tea/openssl.org/v1.1.1 to the execution environment
cargo: Compiling my-rust-ssl-proj
```

{% hint style="info" %}
Idiomatically, `-node` can be used to exclude a package that may already
exist in the environment.

`'-*'` can be used to exclude everything. Note that you typically will need
to quote the asterisk since shells will otherwise interpret it as an attempt
to glob.
{% endhint %}

{% hint style="info" %}
The first argument that doesn’t start with `-` or `+` is considered the
first argument to the runner. All arguments that follow are passed to that
program.
{% endhint }


## Disambiguation

In some cases `tea foo` may be ambiguous because multiple packages provide
`foo`.

In such cases `tea` will error and ask you be more specific by using
fully-qualified-names :

```sh
$ tea yarn --version
error: multiple projects provide `yarn`. please be more specific:

    tea +classic.yarnpkg.com yarn --version
    tea +yarnpkg.com yarn --version
```

In general it's a good idea to specify fully qualified names in
scripts, etc. since these will always be unambiguous.


## Running System Commands

It can be useful to run system commands with a package environment injected.
To do this specify the full path of the system executable:

```sh
tea +llvm.org /usr/bin/make
```

> If you only specified `make` rather than `/usr/bin/make` then `tea` would
> install make for you and use that.


[SemVer]: https://devhints.io/semver
[pantry]: pantry.md
