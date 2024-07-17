# Troubleshooting pkgx

This document provides solutions to common issues users may encounter when using `pkgx`. If your problem is not listed here, please [open an issue](https://github.com/pkgxdev/pkgx/issues) on GitHub.

## Common Issues

### 1. Installation Issues

**Problem**: Installation fails or `pkgx` is not found after installation.

**Solution**:
- Ensure you have followed the [installation guide](https://docs.pkgx.sh/installing-w-out-brew) correctly.
- Make sure your system meets the [minimum requirements](https://docs.pkgx.sh/requirements).
- Verify that `pkgx` is in your `PATH`:
  ```bash
  echo $PATH

### 2. Command Not Found
Problem: Running a command with pkgx results in command not found.

Solution:

- Ensure the command is spelled correctly.
- Check if the package is supported by pkgx:

### 3. Problem: Errors related to missing dependencies.
Problem: Errors related to missing dependencies.

Solution:

- Use pkgx to install the required dependencies:
    ```bash
    pkgx <dependency>
    ```

### 4.  Shell Integration Problems
Problem: Shell integration is not working as expected.

Solution:

- Verify that shell integration is set up correctly by running:
    ```bash
    pkgx integrate --dry-run
    ```
- Follow the detailed shell integration guide: [Shell Integration](https://docs.pkgx.sh/using-pkgx/shell-integration).

### 5.  Docker Issues
Problem: Issues running pkgx within Docker.

Solution:

- Ensure you have the latest version of Docker installed.
- Follow the [Docker](https://docs.pkgx.sh/docker) guide to set up pkgx in Docker.
- Example Dockerfile:
    ```dockerfile
    FROM pkgxdev/pkgx
    RUN pkgx node@16
    ```

### 6. CI/CD Integration Problems
Problem: Issues integrating pkgx in CI/CD pipelines.

Solution:

- Ensure the CI/CD environment has internet access to download pkgx.
- Follow the CI/CD integration guide for detailed instructions.
- Example configuration for GitHub Actions:
    ```yaml
    - uses: pkgxdev/setup@v1
    - run: pkgx shellcheck
    ```

### Reporting Issues
If you have tried the above solutions and are still experiencing problems, please [open an issue](https://github.com/pkgxdev/pkgx/issues) on GitHub. Provide as much detail as possible, including:

- Steps to reproduce the issue.
- Expected and actual behavior.
- Logs and error messages.
- Environment details (OS, pkgx version, etc.).

### Further Help
For more help, you can:

- Visit our [documentation](https://docs.pkgx.sh/).
- Join the [community discussions](https://github.com/pkgxdev/pkgx/discussions).
- Reach out to us on [Twitter/X](https://x.com/pkgxdev) or via [Discord](https://discord.gg/w2YXwbZj).

Thank you for using `pkgx`!
