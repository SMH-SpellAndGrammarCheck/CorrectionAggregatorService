/*
 * A simple Web App for uploading PDFs and send them to another service for further processing.
 * ------------------
 * Author: SMH - Sandro Speth, Matthias Hermann, Heiko Geppert
 * Version: 1.0.0
 */
const express = require('express');
let app = express();
const http = require('http');
var querystring = require('querystring');
const fs = require('fs');
const path = require('path');
const uuidv4 = require('uuid/v4');
const azure = require('azure');
const HashMap = require('hashmap');
const child_process = require('child_process');
const PORT = process.env.PORT || 1338;

let messages = new HashMap();

// Read queue data and create queue if not already exists
let queueData = {}
if (process.env.QUEUE_NAME === undefined || process.env.CONNECTION_STRING === undefined) {
    queueData = JSON.parse(fs.readFileSync(__dirname + '/queue.json', 'utf8', (err) => {
        console.log('[Error] Error while reading queue data');
    }));
} else {
    queueData = {
        "queuename": process.env.QUEUE_NAME,
        "connectionString": process.env.CONNECTION_STRING
    }
}

const emailServiceConnectionData = process.env.MAILD_HOSTNAME || 'localhost';

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

let processMessage = (message) => {
    // console.log(message);
    let correlationid = message.customProperties.correlationid;
    if (!messages.has(correlationid)) {
        let dataCollection = {
            correlationid: correlationid,
            email: message.customProperties.email,
            lastChunkReceived: message.customProperties.lastone,
            receivedChunks: [message.customProperties.chunknr],
            chunks: [
                {
                    chunknr: message.customProperties.chunknr,
                    findings: message.customProperties.findings,
                    body: message.body
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
            findings: message.customProperties.findings,
            body: message.body
        });
    }
    console.log(messages.get(correlationid));
    if (isAllDataReceived(messages.get(correlationid))) {
        let dataCollection = messages.get(correlationid);
        let aggregatedMessage = aggregate(dataCollection);
        sendMessageToEmailService(aggregatedMessage);
    }
};

let receive = () => {
    serviceBusService.receiveQueueMessage(queueData.queuename, function (error, receivedMessage) {
        if (!error) {
            // Message received and deleted
            // if (receivedMessage.customProperties.findings) {
            processMessage(receivedMessage);
            // }

        } else {
            console.log('[Log] Error receiving messages');
        }
        setTimeout(function () {
            receive();
        }, 1000);
    });
}

let sendMessageToEmailService = (aggregatedMessage) => {
    child_process.exec("curl -d \"" + aggregatedMessage.body + "\" -H \"email: " + aggregatedMessage.email + "\" " + emailServiceConnectionData + ":8080\n",
        undefined,
        (error, stdout, stderr) => {
            console.log("Error: %o", error)
        })
};

let aggregate = (dataCollection) => {
    let aggregatedMessage = {
        email: dataCollection.email,
        body: ""
    };
    let chunks = dataCollection.chunks;
    chunks.forEach((chunk) => {
        if (chunk.findings) {
            aggregatedMessage.body += chunk.body;
        }
    });

    return aggregatedMessage;
};

let isAllDataReceived = (dataCollection) => {
    if (dataCollection.lastChunkReceived) {
        let receivedChunks = dataCollection.receivedChunks;
        sort(receivedChunks);
        sortChunks(dataCollection.chunks);
        let lastIndex = receivedChunks[receivedChunks.length - 1];
        console.log(lastIndex);
        return lastIndex == receivedChunks.length - 1;
    } else {
        return false;
    }
};

let sort = (array) => {
    for (let i = 0; i < array.length; i++) {
        for (let j = 0; j < array.length; j++) {
            if (array[i] < array[j]) {
                let tmp = array[i];
                array[i] = array[j];
                array[j] = tmp;
            }
        }
    }
};

let sortChunks = (chunks) => {
    for (let i = 0; i < chunks.length; i++) {
        for (let j = 0; j < chunks.length; j++) {
            if (chunks[i].chunknr < chunks[j].chunknr) {
                let tmp = chunks[i];
                chunks[i] = chunks[j];
                chunks[j] = tmp;
            }
        }
    }
};

let testi = () => {
    console.log('test');
    let test = {
        correlationid: uuidv4(),
        email: 'sandro.speth@web.de',
        lastChunkReceived: true,
        receivedChunks: [0, 2, 1],
        chunks: [{ chunknr: 0, findings: false, body: 'In the orinal sentence:\nThis is an example sentence\n the following tokens have been found:\n\n' },
        { chunknr: 2, findings: true, body: 'In the orinal sentence:\nIt has sme mispellings\n the following tokens have been found:\nsme -> some\n\n' },
        { chunknr: 1, findings: false, body: 'In the orinal sentence:\nBut those are for a reason\n the following tokens have been found:\n\n' }]
    };
    if (isAllDataReceived(test)) {
        console.log(aggregate(test));
        // console.log(true);
    } else {
        console.log('wrong');
    }
};
testi();

receive();
