'use strict';
const express = require('express'); // eslint-disable-line node/no-missing-require
const dotenv = require('dotenv');
const AuthorizationV1 = require('watson-developer-cloud/authorization/v1');

// Setup express
const app = express();
app.use(express.static('dist'));

// Allow cors
// app.use(function(req, res, next) {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//   next();
// });

// Optional: load environment properties from a .env file
dotenv.load({ silent: true });

// Grab the apikey and url for authentication
const authService = new AuthorizationV1({
  iam_apikey: process.env.APIKEY,
  url: process.env.URL
});

// Respond to /api/token GET requests
app.get('/api/token', function(request, response) {
  authService.getToken(function(error, token) {
    if (error) {
      console.log('Error retrieving token: ', error);
      return response.status(500).send('Error retrieving token');
    }
    response.send(token);
  });
});

const port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log('****************************');
  console.log('Server running at port: ' + port);
  console.log('****************************');    
});