# Using `dev`

`dev` is a tool for managing developer environments. It is built on top of
`tea` and the tea pkging primitives and automatically determines the packages
you need based on your project’s keyfiles.

```sh
$ node --version
command not found: node

$ ls
package.json …

$ dev
found package.json; adding `node` to the environment
(+node) $ node --version
v20.5.0
```

Here because there’s a `package.json` we know you want `node`.

If there’s a `.node-version` file we read that:

```sh
$ cat .node-version
v18

$ dev

(+node=18.16) $ node --version
v18.16.0
```

We understand all the conventions and files. If we don’t understand one you
use [let us know] and we’ll add it.

{% hint style="info" %}
The environment is only active while your terminal is inside that directory.

This is persisted across terminal sessions.

If you want to disable this behavior, deactivate it inside the project
directory:

```sh
(+node) $ dev off
```

{% endhint %}

{% hint style="info" %}
We even add version control systems like `git`, `svn` and `hg`.
{% endhint %}

{% hint style="success" %}
Because we read the keyfiles of different project types, use of `dev` is
entirely optional for your users and coworkers. They can either use `dev`,
manually construct the environment with `tea` or source their deps themselves.
{% endhint %}


## Customizing the Environment

Projects require specific versions. To facilitate this we allow you to
supplement the project files that indicate tooling. For example in a
`package.json` file:

```json
{
  "name": "my-project",
  "dependencies": […],
  "tea": "node@16.20.1 imagemagick optipng@0"
}
```

In files that support comments we use YAML front matter:

```toml
# pyproject.toml

#---
# tea:
#   python@3.10
#---
```

Our preference is comments, JSON doesn’t support comments so we have to stick
a `tea` node in there.

{% hint style="info" %}
We read all the files in your project, but only at the root level. If you move
up a level and it has its own environment you will need to activate that
separately.
{% endhint %}


### Overriding Defaults

Multiple projects can read `package.json`. If you want to use `bun` rather
than `node` just specify that in your `package.json` (or `tea.yaml`):

```json
{
  "name": "my-project",
  "dependencies": […],
  "tea": "bun@0.5"
  }
}
```

### `tea.yaml`

We supplement the existing files to be less intrusive, but if you prefer you
can instead add a `tea.yaml` (or `.tea.yaml`) file to your repo.

### Controlling Shell Environment Variables

It can be convenient to control shell environment variables for work projects.

```sh
$ cat pyproject.toml

#---
# dependencies:
#   deno@1.35
# env:
#   DENO_DIR: ./deno
#   VERSION: 1.2.3
#---

$ dev

(+deno+python) $ echo $VERSION
1.2.3
```

{% hint style="info" %}
You can either prefix the YAML with a root `tea` node as above or drop
that considering our metadata is universal this seems acceptable, but using
a `tea` root is safer. If you use a `tea` and you only have deps you can
specify just the deps. We support specification as strings, arrays or
dictionaries so pick the one that feels right to you.
{ endhint %}

## Adding New Dependencies to an Activated Developer Environment

Edit the relevant files and `cd .` to trigger the environment to reload.


## Using Activated Environments in Editors

Generally programmer editors should see tools if the environments are
activated. If no, [let us know] and we’ll fix it.



[let us know]: https://github.com/teaxyz/cli/issues/new
