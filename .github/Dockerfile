FROM debian:buster-slim as stage0
COPY ./products/* /pkgx/
RUN cp /pkgx/$(uname -m) /usr/local/bin/pkgx
RUN touch /root/.bash_profile
RUN pkgx integrate

FROM debian:buster-slim as stage1
COPY --from=stage0 /usr/local/bin/pkgx /usr/local/bin/pkgx
COPY --from=stage0 /root/.bash_profile /root/.bash_profile
RUN apt-get update && apt --yes install libc-dev libstdc++-8-dev libgcc-8-dev netbase libudev-dev
CMD ["bash"]
