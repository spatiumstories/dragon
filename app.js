const express = require('express')
const app = express();
const port = 3000
const deso = require('./deso');
const crypto = require('crypto');
const bodyParser = require('body-parser');

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
    const book_id = body['BookID']
    let book_key = crypto.randomBytes(32).toString('hex');
    // crypto.webcrypto.getRandomValues(book_key);
    const url_key = crypto.randomBytes(32).toString('hex');
    // crypto.webcrypto.getRandomValues(url_key);
    console.log("book_key " + book_key);
    console.log("url key " + url_key);
    
    let data = {
        'book_id': book_id,
        'book_key': book_key,
        'url_key': url_key,
    }

    let response = await deso.sendMessage(data, book_title, author_public_key);
    let returnMe = {
        'TxnHashHex': response['TxnHashHex']
    };
    return returnMe;
}

app.use(bodyParser.json({extended: true}));

app.post('/publish', async (req, res) => {
  console.log(req.body);
  let body = await sendMessage(req.body);
  res.send(body);
});

app.get('/messages', async (req, res) => {
    let body = await deso.getMessages(req.headers['author'], req.headers['book_id']);
    res.send(body);
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})