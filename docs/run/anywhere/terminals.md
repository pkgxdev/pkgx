# Getting Started

```sh
brew install teaxyz/pkgs/tea-cli
```

## Without `brew`

If you don’t use [`brew`] or are on a platform `brew` doesn’t support  then
`tea` is a single standalone binary you can download yourself.

### The Installer Script

If you are comfortable with it and don’t use `brew` then the installer is
easiest:

```sh
curl -fsS https://tea.xyz | sh
```

### Downloading Directly

This is all the installer does.

```sh
# download it to `./tea`
curl -o ./tea --compressed -f --proto '=https' https://tea.xyz/$(uname)/$(uname -m)

# install it to `/usr/local/bin/tea`
sudo install -m 755 tea /usr/local/bin

# check it works
tea --help
```

</details>

### Via GitHub Releases

Or download from [GitHub Releases].


[`brew`]: https://brew.sh
[GitHub Releases]: https://github.com/teaxyz/cli/releases
