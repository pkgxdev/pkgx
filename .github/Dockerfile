FROM debian:buster-slim AS stage0
COPY ./products/* /pkgx/
RUN install -m 755 /pkgx/$(uname -m) /usr/local/bin/pkgx
RUN install -m 755 /pkgx/pkgm /usr/local/bin/pkgm
RUN echo 'export PS1="\\[\\033[38;5;63m\\]pkgx\\[\\033[0m\\]\\w $ "' >> /root/.bashrc

FROM debian:buster-slim AS stage1
RUN apt-get update && apt --yes install libc-dev libstdc++-8-dev libgcc-8-dev netbase libudev-dev ca-certificates
COPY --from=stage0 /usr/local/bin/pkgx /usr/local/bin/pkgx
COPY --from=stage0 /usr/local/bin/pkgm /usr/local/bin/pkgm
COPY --from=stage0 /root/.bashrc /root/.bashrc
ENV BASH_ENV=/root/.bashrc
ENV CLICOLOR_FORCE=1
SHELL ["/bin/bash", "-c"]
CMD ["/bin/bash", "-i"]
ENTRYPOINT ["/usr/local/bin/pkgx"]
