# Getting Started

Installing with [`brew`] is most straight forward:

```sh
brew install pkgxdev/made/pkgx
```

# Other Ways to Install

1. After `brew` our installer is easiest:

```sh
curl -fsS https://pkgx.sh | sh
```

{% hint style='info' %}
Wanna read that script before you run it? [github.com/pkgxdev/setup/installer.sh][installer]
{% endhint %}

&nbsp;

2. `pkgx` is a standalone binary, so (if you want) you can just download it directly:

```sh
# download it to `./pkgx`
curl -o ./pkgx --compressed -f --proto '=https' https://pkgx.sh/$(uname)/$(uname -m)

# install it to `/usr/local/bin/pkgx`
sudo install -m 755 pkgx /usr/local/bin

# check it works
pkgx --help
```

For your convenience we provide a `.tgz` so you can one-liner that:

```sh
curl -Ssf https://pkgx.sh/$(uname)/$(uname -m).tgz | sudo tar xz -C /usr/local/bin
```

&nbsp;

3. You can also download straight from [GitHub Releases].

{% hint style='warning' %}
If you download manually you’ll need to move the binary somewhere in
your `PATH`.
{% endhint %}


[`brew`]: https://brew.sh
[GitHub Releases]: https://github.com/pkgxdev/pkgx/releases
[installer]: https://github.com/pkgxdev/setup/blob/main/installer.sh
