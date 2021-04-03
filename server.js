const express = require('express');
const bodyParser = require('body-parser')
const path = require('path');
var cors = require('cors')
const app = express();

app.use(cors())

app.use(express.static(path.join(__dirname, 'dist')));

app.get('/ping', function (req, res) {
 return res.send('pong');
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(process.env.PORT || 8080);