#!/bin/bash

# script to bring up transparent web cache app offlineweb

docker network create beluga 2>/dev/null

if [ -z "$OFFLINE" ]; then
  docker image rm caspia/offlineweb:latest
  docker build -t caspia/offlineweb:latest .
fi

docker run -p "80:3129" -p "443:3130" \
  -v /var/run/docker.sock:/tmp/docker.sock:ro \
  -v $OFFLINEWEB_CACHEPATH:/var/cache/offlineweb \
  -v $OFFLINEWEB_LOGPATH:/var/log/offlineweb \
  -v $OFFLINEWEB_CERTIFICATEPATH:/root/app/certificates:ro
  --name offlineweb --ip="172.20.0.100" \
  --network="beluga" --rm \
  --cap-add NET_ADMIN \
  caspia/offlineweb:latest
