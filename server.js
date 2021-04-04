const express = require('express');
const bodyParser = require('body-parser')
const path = require('path');
const app = express();
//const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');

// Azure Key Vault service to use
const { KeyClient } = require("@azure/keyvault-keys");


// Azure authentication library to access Azure Key Vault
const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");
// Azure SDK clients accept the credential as a parameter
const credential = new DefaultAzureCredential();
console.log('credential', credential)
let vaultUrl = 'https://vitalpointkeys.vault.azure.net/'
console.log('vault', vaultUrl)

// Create authenticated client
const client = new SecretClient(vaultUrl, credential);
console.log('client', client)
// Use service from authenticated client




app.use(express.static(path.join(__dirname, 'dist')));

// async function getSeed(name = 'projects/861244702207/secrets/APPSEED' ) {
//   // Instantiates a client
//   const client = new SecretManagerServiceClient();

//   async function getSecret() {
//     const [secret] = await client.getSecret({
//       name: name,
//     });

//   const policy = secret.replication.replication;

//   console.info(`Found secret ${secret.name} (${policy})`);

//   getSecret()
//   }
// }

// let seed

app.get('/appseed', async (req, res) => {
  let getResult
  try{
  getResult = await client.getSecret("APPSEED")
  console.log('getResult', getResult)
  } catch (err) {
    console.log('error retrieving secret', err)
  }
  res.send(getResult);
 });


app.get('/ping', function (req, res) {
 return res.send('pong');
});

app.get('/', function (req, res) {
  console.log('here', res)
  authorize()
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(process.env.PORT || 8080);