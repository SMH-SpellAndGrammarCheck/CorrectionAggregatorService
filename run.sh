#!/usr/bin/env bash

sudo docker stop aggregatord
sudo docker rm aggregatord

echo "Please enter the host name of the mail daemon: "
read MAILD_HOSTNAME
echo

sudo docker run -d -it \
    -p 1338:1338 \
    -e MAILD_HOSTNAME="${MAILD_HOSTNAME}" \
    --name=aggregatord \
    aggregator_service
