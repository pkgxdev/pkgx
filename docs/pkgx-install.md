# `pkgx install`

To install `node`:

```sh
$ pkgx install node
installed: ~/.local/bin/node
```

Installations are just stubs that precisely specify what version of tools you
want:

```sh
$ cat ~/.local/bin/node
#!/bin/sh
exec pkgx +nodejs.org=20.5.1 node "$@"
```

{% hint style="info" %}
Indeed, we only install one file to the system environment.
Packages cache to `~/.pkgx`, if you were to delete `~/.pkgx` the installed shim
would still work.
{% endhint %}

{% hint style="success" %}
Because `pkgx install` operates via a `pkgx` shim, only the tools you install
become available to the system environment. Open source is complex and tools
can have hundreds of dependencies. With `pkgx` you don’t pollute your system
with these unwanted tools (thus avoiding a myriad of unexpected consequences).

**All your tools have minimal surface area.**
{% endhint %}


## `sudo pkgx install`

If you invoke `pkgx install` with `sudo` we install to `/usr/local/bin`.

{% hint style="info" %}
It would be insecure to store the package caches in userland (`~/.pkgx`)
and tools would not work for multiple users anyway; so if you install with
root we also cache the packages (root-owned ofc) in `/usr/local/opt`.
{% endhint %}


## Installing the active environment

As a convenience `pkgx install` (unadorned) installs the active environment.

```sh
$ env +node

(+node) $ pkgx install
installed: ~/.local/bin/node

$ env -node
error: node is installed  # installed items are removed from the environment

$ env +node
error: node is installed

$ env +node@20
error: node@20 is installed

$ env +node@18
# ^^ this is ok since you didn’t install this version

(+node@18) $ node --version
v18.17.0
```


## Controlling Installed Package Versions

```sh
pkgx install ruff@latest
```

Similarly:

```sh
pkgx install node@16
```


## `pkgx uninstall`

```sh
[sudo] pkgx uninstall node
```

If you `sudo` installed you will need to `sudo` uninstall.
