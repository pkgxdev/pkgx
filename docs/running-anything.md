# `pkgx`—pkg runner

Run anything:

```sh
$ pkgx openai --version
openai 0.27.8
```

{% hint style="success" %}
Command not found? Command no problem.

```sh
$ deno run https://example.com/hello-world.ts
^^ type `x` to run that

$ x
env +deno && deno run https://example.com/hello-world.ts
deno: hello, world!

$ deno --version
deno 1.36.1
# ^^ deno is added to the environment for the session duration
```

The above requires [shell integration] (run: `pkgx integrate --dry-run`).

{% endhint %}


## Run Any Version

```sh
$ pkgx postgres@12 --version
postgres (PostgreSQL) 12.14
```

{% hint style="info" %}

Generally you probably want `@` syntax, but if you need more specificity we
fully support [SemVer]:

```sh
$ pkgx postgres^12 --version
postgres (PostgreSQL) 12.14

$ pkgx "postgres>=12<14" --version
postgres (PostgreSQL) 13.11

$ pkgx deno=1.35.3 --version
deno 1.35.3
```

{% endhint %}

### Running the Latest Version

`pkgx foo` runs the latest “foo” that **is installed**.

If you want to ensure the latest version of foo is installed, use
`pkgx foo@latest`.

{% hint style="info" %}

Specify `pkgx@latest` to ensure you have the latest `pkgx` installed.

```sh
$ pkgx@latest npx@latest cowsay@latest 'fancy a cuppa?'
 ________________
< fancy a cuppa? >
 ----------------
        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||
```

The newer pkgx is installed to `~/.pkgx` like every other pkg. If you need
the installed `pkgx` to be updated then `brew upgrade` or re-run the
installer.

{% endhint %}


## Endpoints

Some packages provide typical usages via an `endpoint` entry in their [pantry]
entry and can be started via `pkgx +brewkit -- run`.

These are often used to do the equivalent of a project’s getting
started steps. For example `pkgx +brewkit -- run llama.cpp` downloads the model and launches a
chat interface and `pkgx +brewkit -- run stable-diffusion-webui` launches the web-ui.


## Adding Additional Packages to the Execution Environment

With our shellcode `env +openssl` adds OpenSSL to the shell environment.
When using `pkgx` as a runner you can add additional packages to the execution
environment with the same syntax:

```sh
$ pkgx +openssl cargo build
pkgx: added ~/.pkgx/openssl.org/v1.1.1 to the execution environment
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

In some cases `pkgx foo` may be ambiguous because multiple packages provide
`foo`.

In such cases `pkgx` will error and ask you be more specific by using
fully-qualified-names :

```sh
$ pkgx yarn --version
error: multiple projects provide `yarn`. please be more specific:

    pkgx +classic.yarnpkg.com yarn --version
    pkgx +yarnpkg.com yarn --version
```

In general it's a good idea to specify fully qualified names in
scripts, etc. since you want these to work forever.


## Running System Commands

It can be useful to run system commands with a package environment injected.
To do this either specify the full path of the system executable:

```sh
pkgx +llvm.org /usr/bin/make
```

Or use `--` which is the standard POSIX way to tell tools like `pkgx` to stop
processing args:

```sh
pkgx +llvm.org -- make  # finds `make` in PATH, failing if none found
```

{% hint style="warning" %}

If you only specified `make` rather than `/usr/bin/make` then `pkgx` would
install GNU make for you and use that.

{% endhint %}


[SemVer]: https://devhints.io/semver
[pantry]: pantry.md
[shell integration]: shell-integration.md
