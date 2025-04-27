#!/usr/bin/env bash

docker run --rm -p 5333:5333/udp \
  -v $(pwd)/zika.toml:/config.toml \
  zika
