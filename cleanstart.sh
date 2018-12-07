rm -rf ~/offlineweb/*
cd ../beluga
./down.sh
./build.sh
./up.sh
cd ../offlineweb
docker logs -f offlineweb
