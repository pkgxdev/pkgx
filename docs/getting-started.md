There are quite a few ways to install `pkgx` but this is our recommendation:

```sh
brew install pkgxdev/made/pkgx || curl https://pkgx.sh | sh
```

# Complete Installation Method Listing

1. ## Homebrew

   ```sh
   brew install pkgxdev/made/pkgx
   ```

2. ## cURL Installer

   Our installer both installs and upgrades `pkgx`:

   ```sh
   curl -fsS https://pkgx.sh | sh
   ```

   {% hint style='info' %}
   Wanna read that script before you run it?
   [github.com/pkgxdev/setup/installer.sh][installer]
   {% endhint %}

3. ## Download Manually

   `pkgx` is a standalone binary, so you can just download it directly:

   ```sh
   # download it to `./pkgx`
   curl -o ./pkgx \
      --compressed --fail --proto '=https' \
      https://pkgx.sh/$(uname)/$(uname -m)

   # install it to `/usr/local/bin/pkgx`
   sudo install -m 755 pkgx /usr/local/bin
   ```

   For your convenience we provide a `.tgz` so you can one-liner that:

   ```sh
   curl -Ssf https://pkgx.sh/$(uname)/$(uname -m).tgz | sudo tar xz -C /usr/local/bin
   ```

   You can also download straight from [GitHub Releases].

4. ## Cargo

   ```sh
   cargo install pkgx
   ```

5. ## Docker

   ```sh
   docker run -it pkgxdev/pkgx

   # or, eg.
   docker run pkgxdev/pkgx +python@3.10 node@22 start
   ```

   Or in your `Dockerfile`:

   ```Dockerfile
   FROM pkgxdev/pkgx
   RUN pkgx +node@16 npm start
   ```

   > [hub.docker.com/r/pkgxdev/pkgx](https://hub.docker.com/r/pkgxdev/pkgx)

6. ## GitHub Actions

   ```yaml
   - uses: pkgxdev/setup@v2
   ```

   > [github.com/pkgxdev/setup](https://github.com/pkgxdev/setup)

   {% hint style='success' %}
   `pkgx` makes it easy to consistently use the GNU or BSD versions of core
   utilities across different platforms—handy for cross-platform CI/CD
   scripts.

   ```sh
   pkgx +gnu.org/coreutils ls
   ```

   {% endhint %}

7. ## Arch Linux

   If you're on Arch Linux (or any of it's derivatives) you can also use the
   [`pkgx` AUR] (latest released version) or [`pkgx-git` AUR] (latest
   development version, might not be stable).

   {% hint style='warning' %}
   The AURs are community-maintained and might be out-of-date. Use them with caution.
   {% endhint %}

[GitHub Releases]: https://github.com/pkgxdev/pkgx/releases
[installer]: https://github.com/pkgxdev/setup/blob/main/installer.sh
[`pkgx` AUR]: https://aur.archlinux.org/packages/pkgx
[`pkgx-git` AUR]: https://aur.archlinux.org/packages/pkgx-git
