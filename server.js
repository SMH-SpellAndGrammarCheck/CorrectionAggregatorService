/*
 * A simple Web App for uploading PDFs and send them to another service for further processing.
 * ------------------
 * Author: SMH - Sandro Speth, Matthias Hermann, Heiko Geppert
 * Version: 1.0.0
 */
const express = require('express');
let app = express();
const http = require('http');
const fs = require('fs');
const path = require('path');
const uuidv4 = require('uuid/v4');
const azure = require('azure');
const HashMap = require('hashmap');
const PORT = process.env.PORT || 1337;

let messages = new HashMap();

// Read queue data and create queue if not already exists
const queueData = JSON.parse(fs.readFileSync(__dirname + '/queue.json', 'utf8', (err) => {
    console.log('[Error] Error while reading queue data');
}));

const serviceBusService = azure.createServiceBusService(queueData.connectionString);
serviceBusService.createQueueIfNotExists(queueData.queuename, function (error) {
    if (!error) {
        // Queue exists
        console.log('[Log] Queue exists!');
    }
});

// Create Server
let server = app.listen(PORT, () => {
    let host = server.address().address;
    let port = server.address().port;
    console.log("[API] [Start] Listening at http://%s:%s", host, port);
});


let receive = () => {
    let message = {};
    serviceBusService.receiveQueueMessage(queueData.queuename, function (error, receivedMessage) {
        if (!error) {
            // Message received and deleted
            message = receivedMessage;
            // spellCheck(receivedMessage);
            // console.log(receivedMessage.body);
        }
    });
    
    let correlationid = message.customProperties.correlationid;
    if (!messages.has(correlationid)) {
        let dataCollection = {
            correlationid: correlationid,
            email: message.customProperties.email,
            lastChunkReceived: message.customProperties.lastOne,
            receivedChunks: [message.customProperties.chunknr],
            chunks: [
                {
                    chunknr: message.customProperties.chunknr,
                    original: message.body.original,
                    findings: message.body.findings
                }
            ]
        };
        messages.set(correlationid, dataCollection);
    } else {
        let dataCollection = messages.get(correlationid);
        dataCollection.receivedChunks.push(message.customProperties.chunknr);
        dataCollection.lastChunkReceived = dataCollection.lastChunkReceived ? true : message.customProperties.lastOne;
        dataCollection.chunks.push({
            chunknr: message.customProperties.chunknr,
            original: message.body.original,
            findings: message.body.findings
        });
    }

    if (isAllDataReceived(messages.get(correlationid))) {
        let dataCollection = messages.get(correlationid);
        let aggregatedMessage = aggregate(dataCollection);
        sendMessageToEmailService(aggregatedMessage);
    }

    receive();
}

let sendMessageToEmailService = (aggregatedMessage) => {
    // TODO
};

let aggregate = (dataCollection) => {
    return {}; // TODO
};

let isAllDataReceived = (dataCollection) => {
    if (dataCollection.lastChunkReceived) {
        let receivedChunks = dataCollection.receivedChunks;
        sort(receivedChunks);
        let lastIndex = receivedChunks[receivedChunks.length - 1];
        return lastIndex == receivedChunks.length - 1;
    }
};

let sort = (array) => {
    for (let i = 0; i < array.length; i++) {
        for (let j = 0; j < array.length; j++) {
            if (array[i] < array[j]) {
                let tmp = array[i];
                array[i] = array[j];
                array[j] = array[i];
            }
        } 
    }
};
