const axios = require('axios');
const { encrypt } = require('deso-protocol/src/lib/utils/Utils');
const sign = require('./sign');
const crypto = require('./crypto');
const EC = require('elliptic').ec;
const ec = new EC("secp256k1");
const bs58check = require('bs58check');
const fetch = require('node-fetch');


const SEED_HEX = process.env.SEED_HEX;
const DRAGON_PUB_KEY = process.env.DRAGON_PUB_KEY;

/**
 * Constructs Message object and
 * submits the message to deso blockchain
 * 
 * Should also have the derived key
 * 
 * Message object:
 * 
 * Community-id
 * Channel-id
 * Message-id
 * Sender public key
 * Message type: reply, post
 * Images
 * Timestamp
 * Reply-id: message-id this is a reply to (if a reply)
 * Replies: list of message-id replies



 * @param {message data} message 
 * @returns success or failure
 */
async function sendMessage(data, message, receiver_public_key) {
    console.log(data);
    try {
        let sharedSecret = await getSharedSecret(receiver_public_key, SEED_HEX);
        const encrypted_book_key = crypto.encryptMessage(sharedSecret, data['book_key']).toString('hex');        
        const encrypted_url_key = crypto.encryptMessage(sharedSecret, data['url_key']).toString('hex');        

        let extra_data = {
            'book_id': data['book_id'],
            'book_key': encrypted_book_key,
            'url_key': encrypted_url_key,
        };
        let defaultMessage = `Your book ${message} is now protected by the Dragon!`;
        const encryptedMsgToSend = crypto.encryptMessage(sharedSecret, defaultMessage);
        let messageData = {
            "ExtraData": extra_data,
            "SenderPublicKeyBase58Check": DRAGON_PUB_KEY,
            "RecipientPublicKeyBase58Check": receiver_public_key,
            "EncryptedMessageText": encryptedMsgToSend.toString('hex'),
            "MinFeeRateNanosPerKB": 1000
        };

        let message_uri = "https://node.deso.org/api/v0/send-message-stateless";
        console.log(messageData);
        // const response = await axios.post(message_uri, messageData);
        const response_raw = await fetch(message_uri, {
            method: 'POST', 
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(messageData) // body data type must match "Content-Type" header
        });
        const response = await response_raw.json(); // parses JSON response into native JavaScript objects
        // Get tx, then sign it
        console.log(response);
        let tx_hex = response["TransactionHex"];
        console.log(response);
        let tx_signed_hex = sign.sign(SEED_HEX, tx_hex);

        // Now submit tx
        let submit_uri = "https://node.deso.org/api/v0/submit-transaction";
        let submit_data = {
            "TransactionHex": tx_signed_hex
        }
        // const submit_response = await axios.post(submit_uri, submit_data);

        const submit_response_raw = await fetch(submit_uri, {
            method: 'POST', 
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(submit_data) // body data type must match "Content-Type" header
        });
        const submit_response = await submit_response_raw.json(); // parses JSON response into native JavaScript objects
        // console.log(submit_response.data);
        return submit_response;

    } catch (err) {
        // Handle Error Here
        console.error(err);
        let myErr = JSON.stringify(data) + "\n" + receiver_public_key + "\n" + message;
        return myErr;
    }
}

async function getSharedSecret(publicKey, seed_hex) {
    let private_key_hex = new Buffer(seed_hex, 'hex');
    let public_key_hex = bs58check.decode(publicKey);
    const payload = Uint8Array.from(public_key_hex).slice(3);
    console.log(public_key_hex);

    let sharedPx = crypto.derive(private_key_hex, payload);
    let sharedSecret = crypto.kdf(sharedPx, 32);

    return sharedSecret;
}


async function getMessages(author_public_key, book_id) {
    console.log(author_public_key);
    console.log(book_id);
    let dataToFetch = {
        NumToFetch: 1000,
        PublicKeyBase58Check: DRAGON_PUB_KEY,
        FetchAfterPublicKeyBase58Check: '',
        HoldersOnly: false,
        FollowersOnly: false,
        FollowingOnly: false,
        HoldingsOnly: false,
        SortAlgorithm: 'time',
    }

    let message_uri = "https://node.deso.org/api/v0/get-messages-stateless";
    try {
        // const response = await axios.post(message_uri, dataToFetch);
        const response_raw = await fetch(message_uri, {
            method: 'POST', 
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(dataToFetch) // body data type must match "Content-Type" header
        });
        const response = await response_raw.json(); // parses JSON response into native JavaScript objects
        let contactMessages = response['OrderedContactsWithMessages'];
        let messagesResponse = [];
        for (var i = 0; i < contactMessages.length; i++) {
            console.log("Comparing " + contactMessages[i]['PublicKeyBase58Check'] + " to " + author_public_key);
            if (contactMessages[i]['PublicKeyBase58Check'] === author_public_key) {
                let messages = contactMessages[i]['Messages'];
                console.log("Number of messages: " + messages.length);
                for (var j = 0; j < messages.length; j++) {
                    let message = messages[j];
                    if (message['ExtraData'] !== null) {
                        console.log(JSON.stringify(message['ExtraData']));
                        if (message['ExtraData']['book_id'] === book_id) {
                            let encrypted_book_key = message['ExtraData']['book_key'];
                            let encrypted_url_key = message['ExtraData']['url_key'];
                            try {
                                let publicKey = message['RecipientMessagingPublicKey'];
                                let sharedSecret = await getSharedSecret(publicKey, SEED_HEX);
                                let decrypted_book_key = crypto.decryptMessage(sharedSecret, encrypted_book_key);
                                let decrypted_url_key = crypto.decryptMessage(sharedSecret, encrypted_url_key);
                                let messageToAdd = {
                                    'BookKey': decrypted_book_key,
                                    'URLKey': decrypted_url_key,
                                };
                                return messageToAdd;
                            } catch (e) {
                                console.log(e);
                                continue;
                            }
                        }
                    }
                }
            }
        }
        // await decryptMessages(messagesResponse);
        return {};


    } catch (err) {
        // Handle Error Here
        console.error(err);
    }
}

async function decryptMessages(messages) {
    let encryptedMessages =  [];
    for (var i = 0; i < messages.length; i++) {
        let message = messages[i];
        let encryptedMessage = {
            "EncryptedHex": message.EncryptedText,
            "PublicKey": message.IsSender ? message.RecipientPublicKeyBase58Check : message.SenderPublicKeyBase58Check,
            "IsSender": message.IsSender,
            "Legacy": !message.V2,
        }
        encryptedMessages.push(encryptedMessage);
    }

    let payload = {
        "encryptedMessages": encryptedMessages
    }
    try {
        const response = await axios.post(uri, payload);
        console.log(response.data);
        return "Success!";

    } catch (err) {
        // Handle Error Here
        console.error(err);
    }


}

/**
 * Authorizing a Derived Key 
 * Requires the following information
 * 
 * derived_seed_hex
 * derived_public_key
 * public_key
 * expiration_block
 * access_sig
 * tx_spending_limit
 * 
 * @param {*} data 
 */
async function authorizeDerivedKey(data) {
    let authorize_derived_key_uri = "https://node.deso.org/api/v0/authorize-derived-key";
    let auth_body = {
        "OwnerPublicKeyBase58Check": data['publicKeyBase58Check'],
        "DerivedPublicKeyBase58Check": data['derivedPublicKeyBase58Check'],
        "DerivedKeySignature": true,
        "ExpirationBlock": data['expirationBlock'],
        "AccessSignature": data['accessSignature'],
        "DeleteKey": false,
        "MinFeeRateNanosPerKB": 1700,
        "TransactionSpendingLimitHex": data['transactionSpendingLimitHex']
    }
    console.log(auth_body);
    try {
        const response = await axios.post(authorize_derived_key_uri, auth_body);
        // console.log(response.data);

        // Get tx, then sign it
        let tx_hex = response.data["TransactionHex"];
        let tx_signed_hex = sign.sign(data['derivedSeedHex'], tx_hex);

        // Now submit tx

        let submit_uri = "https://node.deso.org/api/v0/submit-transaction";
        let submit_data = {
            "TransactionHex": tx_signed_hex
        }
        const submit_response = await axios.post(submit_uri, submit_data);
        // console.log(submit_response.data);
        return submit_response.data;

    } catch (err) {
        // Handle Error Here
        console.error(err);
    }
}

module.exports = {
    sendMessage: sendMessage,
    authorizeDerivedKey: authorizeDerivedKey,
    getMessages: getMessages
}

