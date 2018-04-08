#!/usr/bin/env bash

sudo docker stop aggregatord
sudo docker rm aggregatord

echo "Please enter the host name of the mail daemon: "
read MAILD_HOSTNAME
echo
echo "Please enter the Queue name for this instance: "
read QUEUE_NAME
echo
echo "Please enter the connection string for this instance: "
read CONNECTION_STRING


sudo docker run -d -it \
    -p 1338:1338 \
    -e MAILD_HOSTNAME="${MAILD_HOSTNAME}" \
    -e QUEUE_NAME="${QUEUE_NAME}" \
    -e CONNECTION_STRING="${CONNECTION_STRING}" \
    --name=aggregatord \
    aggregator_service
