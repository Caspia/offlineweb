#!/bin/bash

echo ""
echo "=== Building offlineweb"
echo ""

. ./down.sh

docker image rm --force caspia/offlineweb:latest
docker build -t caspia/offlineweb:latest .
