# Getting Started

Installing with [`brew`] is most straight forward:

```sh
brew install teaxyz/pkgs/tea-cli
```

# Other Ways to Install

1. After `brew` our installer is easiest:

   &nbsp;

   ```sh
   curl -fsS https://tea.xyz | sh
   ```

   &nbsp;

   {% hint style='info' %}
   Wanna read that script before you execute it? [github.com/teaxyz/setup/installer.sh][installer]
   {% endhint %}

2. `tea` is a standalone binary, so (if you want) you can also download it directly:

   &nbsp;

   ```sh
   # download it to `./tea`
   curl -o ./tea --compressed -f --proto '=https' https://tea.xyz/$(uname)/$(uname -m)

   # install it to `/usr/local/bin/tea`
   sudo install -m 755 tea /usr/local/bin

   # check it works
   tea --help
   ```

   For your convenience we provide a `.tgz` so you can one-liner that:

   ```sh
   curl -Ssf https://tea.xyz/$(uname)/$(uname -m).tgz | sudo tar xz -C /usr/local/bin
   ```

   &nbsp;

3. You can also download straight from [GitHub Releases].

   {% hint style='warning' %}
   If you download manually you’ll need to move the binary somewhere in
   your `PATH`.
   {% endhint %}


[`brew`]: https://brew.sh
[GitHub Releases]: https://github.com/teaxyz/cli/releases
[installer]: https://github.com/teaxyz/setup/blob/main/installer.sh
