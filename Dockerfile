FROM debian:buster-slim as stage0

RUN apt-get update
RUN apt-get install --yes curl

RUN curl --compressed -LSsf https://tea.xyz/$(uname)/$(uname -m) > /usr/bin/tea
RUN chmod 755 /usr/bin/tea

RUN echo 'source <(/usr/bin/tea --magic=bash --silent)' >> /root/.bashrc

RUN /usr/bin/tea --sync
RUN curl -Lo /root/.tea/install-pre-reqs.sh https://raw.githubusercontent.com/teaxyz/setup/main/install-pre-reqs.sh
RUN rm -rf /root/.tea/tea.xyz/var/www

FROM debian:buster-slim as stage1
COPY --from=stage0 /usr/bin/tea /usr/bin/tea
COPY --from=stage0 /root/.tea /root/.tea

RUN echo 'export PS1="\\[\\033[38;5;86m\\]tea\\[\\033[0m\\] $ "' >> /root/.bashrc && \
  sh /root/.tea/install-pre-reqs.sh && \
  rm /root/.tea/install-pre-reqs.sh

CMD ["bash"]
