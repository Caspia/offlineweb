#!/bin/bash

# script to bring up transparent web cache app offlineweb
echo ""
echo "=== OFFLINEWEB going up"
echo ""

mkdir -p "$OFFLINEWEB_CACHEPATH" -m777
mkdir -p "$OFFLINEWEB_LOGPATH" -m777
echo "OFFLINEWEB_LOGPATH is ${OFFLINEWEB_LOGPATH}"

# only create volumes if appropriate directories exist
if [ -d $OFFLINEWEB_CERTIFICATEPATH ];
then
  OFFLINEWEB_CERTIFICATEPATH_VCMD="-v $OFFLINEWEB_CERTIFICATEPATH:/root/app/certificates:ro"
else
  OFFLINEWEB_CERTIFICATEPATH_VCMD=""
fi

if [ -d $OFFLINEWEB_LOGPATH ]
then
  OFFLINEWEB_LOGPATH_VCMD="-v $OFFLINEWEB_LOGPATH:/var/log/offlineweb"
else
  OFFLINEWEB_LOGPATH_VCMD=""
fi

if [ -d $OFFLINEWEB_CACHEPATH ]
then
  OFFLINEWEB_CACHEPATH_VCMD="-v $OFFLINEWEB_CACHEPATH:/var/cache/offlineweb"
else
  OFFLINEWEB_CACHEPATH_VCMD=""
fi

docker container rm --force offlineweb 2>/dev/null
docker run -p "80:3129" -p "443:3130" -d --restart=always\
  -v /var/run/docker.sock:/tmp/docker.sock:ro \
  $OFFLINEWEB_CERTIFICATEPATH_VCMD \
  $OFFLINEWEB_LOGPATH_VCMD \
  $OFFLINEWEB_CACHEPATH_VCMD \
  --name offlineweb --ip="172.20.0.100" \
  --network="beluga"\
  caspia/offlineweb:latest
