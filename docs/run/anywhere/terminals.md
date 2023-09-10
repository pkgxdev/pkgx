# Getting Started

```sh
brew install teaxyz/pkgs/tea-cli
```

## Without `brew`

If you don’t use [`brew`] or are on a platform `brew` doesn’t support  then
`tea` is a single standalone binary you can download yourself:

```sh
curl -o tea --compressed -f --proto '=https' https://tea.xyz/$(uname)/$(uname -m)
chmod +x ./tea
./tea --help
```

### One Liner

Here’s a one-liner to install `/usr/local/bin/tea`:

```sh
sudo install -m 755 \
  <(curl --compressed -f --proto '=https' https://tea.xyz/$(uname)/$(uname -m)) \
  /usr/local/bin/tea
```

### Via GitHub

Or you can download it from [GitHub Releases].

### Installer Script

Or you can use our installer to put `tea` in `/usr/local/bin`:

```sh
curl -fsS https://tea.xyz | sh
```

The installer is more meant for CI/CD/Docker but it works fine this way too.

[`brew`]: https://brew.sh
[GitHub Releases]: https://github.com/teaxyz/cli/releases
