FROM debian:buster-slim as stage0

RUN apt-get update
RUN apt-get install --yes curl sudo

RUN curl https://tea.xyz | TEA_YES=1 SHELL=bash sh
RUN curl -Lo /root/.tea/install-pre-reqs.sh https://raw.githubusercontent.com/teaxyz/setup/main/install-pre-reqs.sh
RUN echo 'export PS1="\\[\\033[38;5;86m\\]tea\\[\\033[0m\\] $ "' >> /root/.bashrc

FROM debian:buster-slim as stage1
COPY --from=stage0 /root/.tea /root/.tea
COPY --from=stage0 /root/.bashrc /root/.bashrc

RUN sh /root/.tea/install-pre-reqs.sh \
  && rm /root/.tea/install-pre-reqs.sh \
  && ln /root/.tea/tea.xyz/v\*/bin/tea /usr/bin

CMD ["bash"]
