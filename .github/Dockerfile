FROM debian:bookworm-slim AS base

FROM base AS install
COPY ./products/* /pkgx/
RUN install -m 755 /pkgx/$(uname -m) /usr/local/bin/pkgx
RUN install -m 755 /pkgx/pkgm /usr/local/bin/pkgm

FROM base
COPY --from=install /usr/local/bin/pkgx /usr/local/bin/pkgm /usr/local/bin/
ENTRYPOINT ["/usr/local/bin/pkgx"]
CMD ["/bin/bash"]
