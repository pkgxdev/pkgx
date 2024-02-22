FROM debian:buster-slim as stage0
COPY ./products/* /pkgx/
RUN cp /pkgx/$(uname -m) /usr/local/bin/pkgx
RUN echo 'export PS1="\\[\\033[38;5;63m\\]pkgx\\[\\033[0m\\]\\w $ "' >> /root/.bashrc
RUN pkgx integrate

FROM debian:buster-slim as stage1
RUN apt-get update && apt --yes install libc-dev libstdc++-8-dev libgcc-8-dev netbase libudev-dev
COPY --from=stage0 /usr/local/bin/pkgx /usr/local/bin/pkgx
COPY --from=stage0 /root/.bashrc /root/.bashrc
ENV BASH_ENV /root/.bashrc
SHELL ["/bin/bash", "-c"]
CMD ["bash", "-i"]
