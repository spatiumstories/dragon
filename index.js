const AWS = require('aws-sdk');
const deso = require('./deso');
const crypto = require('crypto');

/**
 * Expected json/body:
 * AuthorPublicKey
 * BookTitle
 * BookID
 * @param {*} body 
 * @returns 
 */
 async function sendMessage(body) {
    console.log(body['AuthorPublicKey']);
    const author_public_key = body['AuthorPublicKey'];
    const book_title = body['BookTitle'];
    let book_key = crypto.randomBytes(32).toString('hex');
    // crypto.webcrypto.getRandomValues(book_key);
    const url_key = crypto.randomBytes(32).toString('hex');
    // crypto.webcrypto.getRandomValues(url_key);
    console.log("book_key " + book_key);
    console.log("url key " + url_key);
    
    let data = {
        'book_id': body['BookID'],
        'book_key': book_key,
        'url_key': url_key,
    }

    await deso.sendMessage(data, book_title, author_public_key);
    let returnMe = {
        'BookKey': book_key,
        'URLKey': url_key
    };
    return returnMe;
}


exports.handler = async (event, context) => {
    let body;
    let statusCode = '200';
    const headers = {
        'Content-Type': 'application/json',
    };

    try {
        switch (event.httpMethod) {
            case 'GET':
                body = await deso.getMessages(event.headers['author'], event.headers['book_id']);
                break;
            case 'POST':
                body = await sendMessage(JSON.parse(event.body));
                break;
            default:
                throw new Error(`Unsupported method "${event.httpMethod}"`);
        }
    } catch (err) {
        statusCode = '400';
        body = err.message;
    } finally {
        body = JSON.stringify(body);
    }

    return {
        statusCode,
        body,
        headers,
    };
};
