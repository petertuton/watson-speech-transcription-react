'use strict';

const express = require('express');
const dotenv = require('dotenv');
const AuthorizationV1 = require('watson-developer-cloud/authorization/v1');

// Optional: load environment properties from a .env file
dotenv.load({ silent: true });

// Setup express
const app = express();
app.use(express.static('dist'));
app.use(express.json());

// Initialise constants
const APIKEY=process.env.APIKEY;
const URL=process.env.URL;
const MODEL= process.env.MODEL || 'en-US_NarrowbandModel';
const LANGUAGE_CUSTOMIZATION_ID=process.env.LANGUAGE_CUSTOMIZATION_ID || null;
const ACOUSTIC_CUSTOMIZATION_ID=process.env.ACOUSTIC_CUSTOMIZATION_ID || null;

// Check for required configuration parameters
if (!APIKEY) {
  console.error('No Watson APIKEY provided - aborting');
  return;
}
if (!URL) {
  console.error('No Watson STT URL provided - aborting');
  return;
}

// Setup authentication - only required for token authenticaion
const authService = new AuthorizationV1({
  iam_apikey: APIKEY,
  url: URL
});

//////////////////
// 
// GET /api/config - returns the STT related configuration
// 
app.get('/api/config', (request, response) => {
  response.send(JSON.stringify({
    url: URL,
    model: MODEL,
    language_customization_id: LANGUAGE_CUSTOMIZATION_ID,
    acoustic_customization_id: ACOUSTIC_CUSTOMIZATION_ID
  }));
});

//////////////////
// 
// GET /api/token - returns a Watson authentication token 
// 
app.get('/api/token', (request, response) => {
  authService.getToken((error, token) => {
    if (error) {
      console.error('Error retrieving token: ', error);
      return response.status(500).send('Error retrieving token: ' + error);
    }
    response.send(token);
  });
});

//////////////////
// 
// Start the server
// 
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('****************************');
  console.log('Server running at port: ' + port);
  console.log('****************************');  
});

