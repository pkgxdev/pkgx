# `tea install`

To install `node`:

```sh
$ tea install node
installed: ~/.local/bin/node
```

Installations are just stubs that precisely specify what version of tools you
want:

```sh
$ cat ~/.local/bin/node
#!/bin/sh
exec tea +nodejs.org=20.5.1 node "$@"
```

{% hint style="info" %}
Indeed, we only install one file to the system environment.
Packages cache to `~/.tea`, if you were to delete `~/.tea` the installed shim
would still work.
{% endhint %}

{% hint style="success" %}
Because `tea install` operates via a `tea` shim, only the tools you install
become available to the system environment. Open source is complex and tools
can have hundreds of dependencies. With `tea` you don’t pollute your system
with these unwanted tools (thus avoiding a myriad of unexpected consequences).

**All your tools have minimal surface area.**
{% endhint %}


## `sudo tea install`

If you invoke `tea install` with `sudo` we install to `/usr/local/bin`.

{% hint style="info" %}
It would be insecure to store the package caches in userland (`~/.tea`)
and tools would not work for multiple users anyway; so if you install with
root we also cache the packages (root-owned ofc) in `/usr/local/opt`.
{% endhint %}


## Installing the active environment

As a convenience `tea install` (unadorned) installs the active environment.

```sh
$ tea +node

(+node) $ tea install
installed: ~/.local/bin/node

$ tea -node
error: node is installed  # installed items are removed from the environment

$ tea +node
error: node is installed

$ tea +node@20
error: node@20 is installed

$ tea +node@18
# ^^ this is ok since you didn’t install this version

(+node@18) $ node --version
v18.17.0
```


## Controlling Installed Package Versions

```sh
tea install ruff@latest
```

Similarly:

```sh
tea install node@16
```


## `tea uninstall`

```sh
$ tea install node
$ tea uninstall node
```
