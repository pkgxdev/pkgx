# `tea commit`

Within a package environment (see [`tea use`]), `tea commit` will install
those packages so they are available at the system level.

Let’s use [`ruff`]:

```sh
$ ruff
command not found: ruff

(tea) $ tea use ruff && ruff --version
ruff 0.0.284
```

However new terminal sessions will not have `ruff` without `tea use ruff` or
`x ruff`. This is often what you want—the more packages you install the more
unstable your system can become—however sometimes you want a pkg to always be
accessible. In those cases use `tea commit`

```sh
(tea) $ tea commit

$ ruff --version
ruff 0.0.284
```

When you commit the whole package environment becomes available to your
entire system. The versions of tools are preserved precisely even as updates
become available.

{% hint style="info" %}

`tea commit` is quite simple, it installs some small shell script shims to
your `PATH`.

```sh
$ cat ~/.local/bin/ruff
#!/bin/sh
exec tea +ruff.rs=0.0.284 ruff "$@"
```

We use `+pkg` syntax to ensure the package is disambiguated. Thus if another
pkg ever provides `ruff` your system installed `ruff` will keep working.
{% endhint %}

{% hint style="success" %}
Because commit operates via a `tea` shim, only the tools you commit become
available at the system level. Open source is complex and tools can have
hundreds of dependencies. With `tea` you don’t pollute the system with these
tools which can have unexpected consequences.

All your tools have minimal surface area.
{% endhint %}


## Updating Committed Packages

```sh
$ tea use ruff@latest
(tea) $ tea commit
```


## Versioning Committed Packages

Some tools (like Python) are typically used in a versioned manner. For now
you can achieve this by creating your own shims:

```sh
$ tea use python@3.10
(tea) $ tea commit

$ mv ~/.local/bin/python ~/.local/bin/python3.10
$ python3.10 --version
Python 3.10.12
```


## Using Multiple Packages

```sh
tea use node deno bun
```


[`ruff`]: https://ruff.rs
[`tea use`]: tea-use.md
