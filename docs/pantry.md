# Packaging

There’s millions of open source projects and `tea` needs your help to package
them up!

{% hint style="success" %}
Visit [github.com/teaxyz/pantry] for the full documentation.
{% endhint %}

{% hint style="info" %}
Curious about a specific pkg? `tea pkg edit deno` will open deno’s
`package.yml` in your editor.
{% endhint %}

# Packagers Who Care

You trust us to just work and make your workflows happen.
We take this job seriously and we go the extra mile on a per-package basis,
for example:

* Our `git` ignores `.DS_Store` files by default
* our RubyGems defaults to user-installs and ensures gems are in `PATH`
* Our `python` comes unversioned so the huge numbers of scripts that invoke `/usr/bin/env python` actually work
* Our `pyenv` automatically installs the python versions it needs

Additionally, we insist our pkgs are relocatable, which is why we can install
in your home directory (but this also means you could pick up the whole
`~/.tea` directory and bundle it with your app.) We also begin packaging new releases almost immediately as soon as they go live using various automations.

We care about your developer experience, *not ours*.

[github.com/teaxyz/pantry]: https://github.com/teaxyz/pantry
