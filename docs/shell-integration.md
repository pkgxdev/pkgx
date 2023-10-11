# Shell Integration

## Installing the Shell Integration

The first time you try to use a command that requires shell integration `pkgx`
will let you know:

```sh
$ env +node
pkgx: error: shellcode not loaded
pkgx: ^^run: eval "$(pkgx integrate)"
```

Integration is minimal. We write one line to your `.shellrc` that adds a few
functions to your shell environment. If you like check it out first:

```sh
pkgx --shellcode
```

If you like what you see then you can see what integrate will do in a dry run:

```sh
pkgx integrate --dry-run
```

And then finally integrate:

```sh
$ eval "$(pkgx integrate)"

$ env +node
(+node) $ node --version
Node.js v20.5.0
```

{% hint style="info" %}
`eval`ing the integration means you can immediately start using it, but if
you prefer you can run `pkgx integrate` by itself—it’s just the integration
won’t start working until you start a new terminal session.
{% endhint %}

{% hint style="warning" %}
Once integrated every terminal session will have `pkgx` integration.
If for some reason you need a session without this integration you can unload:

```sh
pkgx unload
```

{% endhint %}

{% hint style="info" %}
To deintegrate `pkgx`’s shellcode you can either:

1. Run `pkgx deintegrate`; or
2. Open your `~/.shellrc` file in an editor and remove our one-liner
{% endhint %}


## Using the Shell Integration

`env +pkg` creates temporary, isolated *package environments* for you to run
commands in.

```sh
$ env +node
(+node) $ node --version
v20.5.1
```

{% hint style="info" %}
The `(+pkg)` that prefixes your prompt indicates your terminal’s environment
has been supplemented with the named pkgs.
{% endhint %}

{% hint style="warning" %}
Our shell integration intercepts calls to `env` only if you are trying to
control the package environment. Other uses are forwarded. Since our
integration is shellcode it will only exist at your prompts, not any deeper
like in shell scripts.
{% endhint %}

Package environments created with `env +pkg` do not persist beyond the current
terminal session. All the same if you need to remove pkgs from your
current session use `env -pkg`.


## Creating Environments for Specific Versions

```sh
$ env +deno@1.33
(+deno) $ deno --version
deno 1.33.4
```

{% hint style="info" %}
When you create environments the packages you request are installed if
necessary.
{% endhint %}


## Supplementing the Environment with Multiple Packages

```sh
$ env +node@16 +imagemagick +optipng
```

Or:

```sh
$ env +node@16
$ env +imagemagick
$ env +optipng
```
