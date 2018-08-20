#!/bin/bash

# script to bring up transparent web cache app offlineweb

docker network create beluga 2>/dev/null

if [ -z "$OFFLINE" ]; then
  docker image rm caspia/offlineweb:latest
  docker build -t caspia/offlineweb:latest .
fi

docker run -d -p "443:3130" \
  --name offlineweb --ip="172.20.0.100" \
  --network="beluga" --rm caspia/offlineweb:latest
