FROM debian:buster-slim as stage0
COPY ./products/* /tea/
RUN cp /tea/$(uname -m) /usr/local/bin/tea
RUN touch /root/.bash_profile
RUN tea integrate

FROM debian:buster-slim as stage1
COPY --from=stage0 /usr/local/bin/tea /usr/local/bin/tea
COPY --from=stage0 /root/.bash_profile /root/.bash_profile
CMD ["bash"]
