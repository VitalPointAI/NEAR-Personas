const express = require('express')
const bodyParser = require('body-parser')
const path = require('path')
const app = express()

// Azure authentication library to access Azure Key Vault
const { DefaultAzureCredential } = require("@azure/identity")
const { SecretClient } = require("@azure/keyvault-secrets")

// Azure SDK clients accept the credential as a parameter
const credential = new DefaultAzureCredential()
let vaultUrl = 'https://vitalpointkeys.vault.azure.net/'

// Create authenticated client
const client = new SecretClient(vaultUrl, credential)

app.use(express.static(path.join(__dirname, 'dist')));

app.get('/appseed', async (req, res) => {
  let getResult
  try{
  getResult = await client.getSecret("APPSEED")
  } catch (err) {
    console.log('error retrieving secret', err)
  }
  res.send(getResult);
 });

 app.get('/didkey', async (req, res) => {
  let getResult
  try{
  getResult = await client.getSecret("DIDCONTRACTPRIVKEY")
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