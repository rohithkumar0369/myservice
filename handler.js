'use strict';

let solanaNameService = require("name-service")
const base58 = require('bs58')

let solana = require("@solana/web3.js");
const connectionDevnet = new solana.Connection(solana.clusterApiUrl('devnet'))

const AWS = require("aws-sdk")
const region = "us-east-2"
const client = new AWS.SecretsManager({
  region: region
})

async function secrets(secreid) {
  return await new Promise((resolve, reject) => {
    client.getSecretValue({ SecretId: secreid }, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}


async function createName(connection, username, userpubkey, payer) {
  let tx = await solanaNameService.createNameRegistry(connection,
    username,
    10,
    payer.publicKey,
    new solana.PublicKey(userpubkey),
    100)
  let tx2 = new solana.Transaction().add(tx)
  let result = await solana.sendAndConfirmTransaction(connection, tx2, [payer])
  return result;

}


module.exports.nameService = async (event) => {

  const body = event.body
  const body2 = JSON.parse(body || '')
 // let aws_secrets = await secrets("fee_payer")
  let aws_secrets = await secrets(process.env.SECRETID)
  // @ts-ignore
  let secret_string = aws_secrets.SecretString
  let secret_key = JSON.parse(secret_string)
  let payer = solana.Keypair.fromSecretKey(base58.decode(secret_key.name_service_payer));
  let userName = body2.name;
  let userPubkey = body2.pubkey;
  let hashedName = await solanaNameService.getHashedName(userName)
  let accountKey = await solanaNameService.getNameAccountKey(hashedName);
  let availableDev;
  let key;

  // checks tha availability of name in devnet

  try {
    let owner = await solanaNameService.getNameOwner(connectionDevnet, accountKey)
    key = owner.owner
  } catch (err) {
    if (err == "Error: Unable to find the given account.") {
      availableDev = 1
    } else {
      availableDev = 0
    }
  }
  if (availableDev) {
    try {
      //devnet name creation
      let resultDev = await createName(connectionDevnet, userName, userPubkey, payer)
      return {
        statusCode: 200,
        body: JSON.stringify({
          error: false,
          message: 'New username added',
          data: resultDev
        })
      };

    } catch (error) {
      console.log(error)
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: true,
          message: "error occured",
          data: error
        })
      };
    }
  } else {
    return {
      statusCode: 200,
      body: JSON.stringify({
        error: true,
        message: 'Username already available',
        data: key
      })
    };
  }
};


module.exports.isNameAvailable = async (event) => {
  const body = event.body
  const body2 = JSON.parse(body || '')
  let userName = body2.name

  let hashedName = await solanaNameService.getHashedName(userName)
  let accountKey = await solanaNameService.getNameAccountKey(hashedName);
  let availableDev;
  let key


  //checks tha availability of name in devnet
  try {
    let owner = await solanaNameService.getNameOwner(connectionDevnet, accountKey)
    key = owner.owner
  } catch (err) {
    if (err == "Error: Unable to find the given account.") {
      availableDev = 1
    } else {
      availableDev = 0
    }
  }

  if (availableDev) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        error: false,
        message: 'Username is not available',
      })
    };
  } else {
    return {
      statusCode: 200,
      body: JSON.stringify({
        error: true,
        message: 'Username is available',
        data: key
      })
    };
  }

}