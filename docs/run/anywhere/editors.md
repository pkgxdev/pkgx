# `pkgx` & Editors

For editors like Visual Studio Code, [`dev`](../../dev.md) is enough to have
it see the tools a project may need.

{% hint style="danger" %}
Make sure you open the project at that directory!
{% endhint %}

Editors that open from the terminal will inherit the active environment you
added via `pkgx` (`dev` uses `pkgx` to construct environments).

For other editors and IDEs you will likely need to `sudo pkgx install` to
ensure the tools are available.


## Extensions & Plugins

We intend to create `pkgx` extensions for programmable editors that support
them. Thus tools will automatically be available whatever you are working on.
