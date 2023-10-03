FROM debian:buster-slim as stage0
COPY ./products/* /pkgx/
RUN cp /pkgx/$(uname -m) /usr/local/bin/pkgx
RUN echo 'export PS1="\\[\\033[38;5;63m\\]pkgx\\[\\033[0m\\] $ "' >> /root/.bashrc
RUN pkgx integrate

FROM debian:buster-slim as stage1
COPY --from=stage0 /usr/local/bin/pkgx /usr/local/bin/pkgx
COPY --from=stage0 /root/.bashrc /root/.bashrc
RUN apt-get update && apt --yes install libc-dev libstdc++-8-dev libgcc-8-dev netbase libudev-dev
CMD ["bash"]
