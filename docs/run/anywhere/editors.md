# `tea` & Editors

For editors like Visual Studio Code, [`dev`](/dev.md) is enough to have it see
the tools a project may need.

{% hint style="danger" %}
Make sure you open the project at that directory!
{% endhint %}

Editors that open from the terminal will inherit the active environment you
added via `tea` (`dev` uses `tea` to construct environments).

For other editors and IDEs you will likely need to `sudo tea install` to
ensure the tools are available.


## Extensions & Plugins

We intend to create a `tea` extension where it makes sense. Automatically
ensuring the tools, frameworks and libraries you need are available whatever
you are working on.
