'use strict';

const express = require('express'); // eslint-disable-line node/no-missing-require
const dotenv = require('dotenv');
const AuthorizationV1 = require('watson-developer-cloud/authorization/v1');
const WatsonSpeech = require('watson-developer-cloud/speech-to-text/v1');
const NodeCache = require('node-cache');
const fileUpload = require('express-fileupload');

const http = require('http');

// Optional: load environment properties from a .env file
dotenv.load({ silent: true });

// Constants, with defaults
const TTL_MINUTES=process.env.TTL || 60;       // Default: 1 hour
const TTL_SECONDS=TTL_MINUTES*60;              // ^ same

// Setup the jobs cache
const recognitionJobsCache = new NodeCache( { stdTTL: TTL_SECONDS } );

// Setup express
const app = express();
app.use(express.static('dist'));
app.use(express.json());
app.use(fileUpload());

// Check for required environment variables
if (!process.env.APIKEY) {
  console.error('No Watson APIKEY provided - aborting');
  return;
}
if (!process.env.URL) {
  console.error('No Watson STT URL provided - aborting');
  return;
}

// Setup authentication - only required for token authenticaion
const authService = new AuthorizationV1({
  iam_apikey: process.env.APIKEY,
  url: process.env.URL
});

// Setup Watson Speech
const watsonSpeech = new WatsonSpeech({
  iam_apikey: process.env.APIKEY,
  url: process.env.URL
});

// Initialise the callback registration
const callback_url = process.env.CALLBACK_URL || null;

//////////////////
// 
// GET /api/token - returns a Watson authentication token 
// 
app.get('/api/token', function(request, response) {
  authService.getToken(function(error, token) {
    if (error) {
      console.error('Error retrieving token: ', error);
      return response.status(500).send('Error retrieving token: ' + error);
    }
    response.send(token);
  });
});

//////////////////
// 
// POST /api/createJob - creates a new async Watson Speech regonition jon
// 
app.post('/api/createJob', function(request, response) {
  if (Object.keys(request.files).length == 0) {
    console.error('No files were uploaded');
    response.status(400).send('No files were uploaded.');
  }

  console.log('Creating job: ', request.files.audio.name);
  console.log(request.files.audio.truncated);

  const params = {
    audio: request.files.audio.data,
    content_type: request.files.audio.mimetype.replace("x-wav", "wav"),
    model: process.env.MODEL,
    language_customization_id: process.env.LANGUAGE_CUSTOMISATION_ID,
    acoustic_customization_id: process.env.ACOUSTIC_CUSTOMISATION_ID, 
    // callback_url,
    // events: 'recognitions.completed_with_results,recognitions.failed',
    results_ttl: TTL_MINUTES,
    timestamps: true,
    smart_formatting: true,
    speaker_labels: true
  };

  watsonSpeech.createJob(params, (error, recognitionJob) => {
    if (error) {
      console.error(error);
      response.status(500).json(error);
    }
    else {
      console.log('Job:', JSON.stringify(recognitionJob, null, 2));
      response.status(200).json(recognitionJob);
    }
  })  
});

//////////////////
// 
// POST /api/checkJob 
//  - checks an existing Watson Speech reconition job's status
//  - returns the job's status (which includes the resulting transcription, if complete)
// 
app.post('/api/checkJob', function(request, response) {
  console.log('Checking job: ', request.body.id);

  // First check the cache for a completed job
  let recognitionJob = recognitionJobsCache.get(request.body.id);
  if (recognitionJob && recognitionJob.status === 'completed') {
    // console.log('Job:', JSON.stringify(recognitionJob, null, 2));
    response.status(200).json(recognitionJob);
    return; 
  }

  const params = {
    id: request.body.id
  };

  watsonSpeech.checkJob(params, (error, recognitionJob) => {
    if (error) {
      console.error(error);
      response.status(500).send(error);
    }
    else {
      // console.log('Job:', JSON.stringify(recognitionJob, null, 2));
      response.status(200).json(recognitionJob);
    }
  })
});

//////////////////
// 
app.get('/api/job_results', function (request, response) {
  console.log(request.body);
  response.set('Content-Type', 'text/plain');
  response.send(request.body);
});

//////////////////
// 
// POST /api/job_results - registers this server as a whitelisted callback for Watson Speech async calls
// 
app.post('/api/job_results', function (request, response) {
  console.log(request.body);

  // recognitionJobsCache.set(recognitionJob.id, recognitionJob);
});

//////////////////
// 
// GET /api/register_callback - registers this server as a whitelisted callback for Watson Speech async calls
// 
function register_callback() {
  console.log('Registering the callback URL');

  // Don't register a callback for localhost... 
  if (process.env.NODE_ENV === 'development') return;

  // Set the callback url to the current hostname if it's not provided
  if (!callback_url) {
    // app.blah
    let server = http.createServer(app);
    console.log(server.address());
  }
  
  let registerCallbackParams = {callback_url};
  
  watsonSpeech.registerCallback(registerCallbackParams, function(error, registerStatus) {
    if (error) {
      console.error(error);
      return false;
    } 

    console.log(JSON.stringify(registerStatus, null, 2));
    callback_url = registerStatus.url;
  });
};

//////////////////
// 
// POST /api/register_callback - returns an echo of the request; as required by the register_callback command
// 
app.post('/api/register_callback', function (request, response) {
});

//////////////////
// 
// Start the server
// 
const port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log('****************************');
  console.log('Server running at port: ' + port);
  console.log('****************************');  
  
  // register_callback();
});

