# Shell Integration

`tea +pkg` creates temporary, isolated *package environments* for you to run
commands in.

```sh
$ tea +node
(+node) $ node --version
v20.5.1
```

{% hint style="info" %}
The `(+pkg)` that prefixes your prompt indicates your terminal’s environment
has been supplemented with the named pkgs.
{% endhint %}

{% hint style="warning" %}
You need to `tea integrate` once to get our shell integration, but commands
that require it will tell you that so don’t worry about doing it until you
need it.
{% endhint %}

Package environments created with `tea +pkg` do not persist beyond the current
terminal session. All the same if you need to remove the pkgenv from your
current session type `tea deactivate`.


## Creating Environments for Specific Versions

```sh
$ tea +deno@1.33
(tea) $ deno --version
deno 1.33.4
```

{% hint style="info" %}
When you create environments the packages you request are installed if
necessary.
{% endhint %}


## Creating Environments for Multiple pkgs

```sh
$ tea +node@16 +imagemagick +optipng
```


# Installing the Shell Integration

The first time you try to use a command that requires shell integration `tea`
will let you know:

```sh
$ tea +node
tea: error: shellcode not loaded
tea: ^^run: source <(tea integrate)
```

Integration is minimal. We write one line to your `.shellrc` that adds a few
functions to your shell environment. If you like check it out first:

```sh
tea --shellcode
```

If you like what you see then you can see what integrate will do in a dry run:

```sh
tea integrate --dry-run
```

And then finally integrate:

```sh
$ source <(tea integrate)

$ tea +node
(+node) $ node --version
Node.js v20.5.0
```

{% hint style="info" %}
`source`ing the integration means you can immediately start using it, but if
you prefer you can run `tea integrate` by itself—it’s just the integration
won’t start working until you start a new terminal session.
{% endhint %}

{% hint style="warning" %}
Once integrated every terminal session will have `tea` integration.
If for some reason you need a session without this integration you can unload:

```sh
tea unload
```

{% endhint %}

{% hint style="info" %}
To deintegrate `tea`’s shellcode you can either:

1. Run `tea deintegrate`; or
2. Open your `~/.shellrc` file in an editor and remove our one-liner
{% endhint %}
