import clone from 'clone';
import WatsonSpeech from './watson-speech';

// Contants
const STT_AUTHURL='/api/token';
const STT_CREATEJOBURL='/api/createJob';
const STT_CHECKJOBURL='/api/checkJob';

export default class RecognitionJob {
  
  //////////////////////////////////////////////////////////////////////////////////////////
  // Constructor 
  //////////////////
  constructor(file, url, model, language_customization_id, acoustic_customization_id) {
    this.STATUS_NOTSTARTED = 'transcribe';
    this.STATUS_PROCESSING = 'processing';
    this.STATUS_COMPLETED = 'completed';

    this.STT_URL=url;
    this.STT_MODEL=model;
    this.STT_LANGUAGE_CUSTOMISATION_ID=language_customization_id;
    this.STT_ACOUSTIC_CUSTOMISATION_ID=acoustic_customization_id;
    
    this.file = file;
    this.id = null;
    this.created = '';
    this.url = '';
    this.status = this.STATUS_NOTSTARTED;
    this.updated = '';
    this.results = '';
    this.transcription = 'Processing... results may take a few moments to return';
  }  

  //////////////////////////////////////////////////////////////////////////////////////////
  // Methods
  //////////////////
  
  isProcessing() {
    return this.status == this.STATUS_PROCESSING;
  };

  isComplete() {
    return this.status == this.STATUS_COMPLETED;
  };
  
  //////////////////
  // 
  // createJob - Calls STT via the server in async mode and returns the regosnition job
  // 
  createJob() {
    console.log('Creating job:', JSON.stringify(this.file.name));

    // Init the status
    this.status = this.STATUS_PROCESSING;

    // Create a form with the job's file
    let formData = new FormData();
    formData.append('audio', this.file);

    // Set the request options
    const options = {
      method: "POST",
      body: formData
    };

    // Create the job
    return fetch(STT_CREATEJOBURL, options)
      .then(response => response.json().then(job => {
        // Set the job details
        this.id = job.id;
        this.created = job.created;
        this.url = job.url;
        this.status = job.status;
        this.transcription = 'Processing... ';
      }))
      .catch(error => console.error('Error:', error));
  }

  //////////////////
  // 
  // checkJob - Calls STT via the server in async mode to check the job status
  // 
  checkJob() {
    if (!this.id) {
      // No id - must call createJob first
      return false;
    }

    console.log('Checking job:', this.file.name, 'Id:', this.id);

    // Set the request options
    const options = {
      method: "POST",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id: this.id })
    };

    // Check the job
    return fetch(STT_CHECKJOBURL, options)
      .then(response => response.json().then(job => {
        // Update the job details
        this.id = job.id;
        this.updated = job.updated;
        this.status = job.status;
        this.results = job.results;

        // Check for completed jobs - they'll contain the job results
        if (this.isComplete()) {
          // Check for an error in the completed jobs results
          if (this.results[0].error) {
            console.error('Error:', this.results[0].error);
            this.transcription = this.results[0].error.sentenceCase();
            return; 
          }

          // Process the results
          let lines = resultsBySpeaker(this.results[0]).results.map(function(result) {
            return 'Speaker ' + result.speaker + ': ' + result.alternatives[0].transcript.sentenceCase();
          });
          this.transcription = lines.join('\n');
          console.log('Completed job:', this.file.name, 'Id:', this.id);
        }
      }))
      .catch(error => console.error(error));    
  }

  //////////////////
  // 
  // transcribe - Calls STT via WebSockets (broken with Chrome and IE!)
  // 
  transcribe() {
    // Set the status to processing
    this.status = this.STATUS_PROCESSING;
    
    // First get an authentication token, then process the file
    // TODO: Only get an auth token if we don't already have and or it's expired
    getToken().then(function(token) {
      try {
        console.log('Transcription started:',this.file.name);
          
        let stream = WatsonSpeech.SpeechToText.recognizeFile({
          access_token: token,
          file: this.file.preview,
          play: false,
          format: true,
          realtime: false,
          resultsBySpeaker: true,

          language_customization_id: this.STT_LANGUAGE_CUSTOMISATION_ID,
          acoustic_customization_id: this.STT_ACOUSTIC_CUSTOMISATION_ID,

          model: this.STT_MODEL,
          url: this.STT_URL,

          'X-Watson-Learning-Opt-Out': true
        });
    
        stream.on('data', function(data) {
          let lines = data.results.map(function(result) {
            return 'Speaker ' + result.speaker + ': ' + result.alternatives[0].transcript;
          });
          // TODO: Replace 'Speaker x' with an actual name, provided by the user via the UI
          let transcription = lines.join('\n');

          // Update the selected job's running transcription
          this.transcription = transcription;

        }.bind(this));

        stream.on('error', function(error) {
          console.error(error);
          this.transcription = 'Transcription error: ' + error;
        }.bind(this));
    
        stream.on('stop', function() {
          console.log('Transcription stopped');
        }.bind(this));
    
        stream.on('finish', function() {
          console.log('Transcription finished');
          this.status = this.STATUS_COMPLETED;
        }.bind(this));
      }
      catch (error) {
        console.error(error);
        this.transcription = 'Transcription error: ' + error;
    }
    }.bind(this));
  }
}

//////////////////
// 
// getToken - Requests an authentication token from the server-side component issuing tokens
//            Returns a -Promise- when the token is provided by the auth server
function getToken() {
  console.log('Requesting authentication token');
  return fetch(STT_AUTHURL)
    .then(response => response.text())
    .catch(error => console.error(error));
}

//////////////////
// 
// resultsBySpeaker 
//  - takes the provided jobresults and formats adds an additional speaker label
//  - this code was 'borrowed' from the SDK at https://github.com/watson-developer-cloud/speech-javascript-sdk/blob/master/speech-to-text/speaker-stream.js
// 
function resultsBySpeaker(jobResults) {

  let final = jobResults.speaker_labels.length && jobResults.speaker_labels[jobResults.speaker_labels.length - 1].final;

  // positions in the timestamps 2d array
  const WORD = 0;
  const FROM = 1;
  const TO = 2;

  // First match all speaker_labels to the appropriate word and result
  // assumes that each speaker_label will have a matching word timestamp at the same index
  // stops processing and emits an error if this assumption is violated
  let resultIndex = 0;
  let timestampIndex = -1;

  let words = jobResults.speaker_labels.map(speaker_label => {
    let result = jobResults.results[resultIndex];
    timestampIndex++;

    let timestamp = result.alternatives[0].timestamps[timestampIndex];
    if (!timestamp) {
      timestampIndex = 0;
      resultIndex++;
      result = jobResults.results[resultIndex];
      timestamp = result && result.alternatives[0].timestamps[timestampIndex];
    }
    if (!timestamp) {
      return null;
    }
    if (timestamp[FROM] !== speaker_label.from || timestamp[TO] !== speaker_label.to) {
      console.error('Mismatch between speaker_label and word timestamp');
      return null;
    }
    return {
      timestamp,
      speaker: speaker_label.speaker,
      result
    };
  });

  // Filter out any nulls
  words = words.filter(w => {
    return w
  });

  // Group the words together into utterances by speaker
  let utterances = words.reduce(function(arr, word) {
    let utterance = arr[arr.length - 1];
    // any time the speaker changes or the (original) result changes, create a new utterance
    if (!utterance || utterance.speaker !== word.speaker || utterance.result !== word.result) {
      utterance = {
        speaker: word.speaker,
        timestamps: [word.timestamp],
        result: word.result
      };
      // and add it to the list
      arr.push(utterance);
    } else {
      // otherwise just append the current word to the current result
      utterance.timestamps.push(word.timestamp);
    }
    return arr;
  }, []);

  // Create new results
  let results = utterances.map(function(utterance, i) {
    // if this is the first usage of this result, clone the original (to keep keywords and such)
    // otherwise create a new one
    let result;
    let lastUtterance = utterances[i - 1] || {};
    if (utterance.result === lastUtterance.result) {
      result = { alternatives: [{}] };
    } else {
      result = clone(utterance.result);
    }

    // update the result object
    // set the speaker
    result.speaker = utterance.speaker;
    // overwrite the transcript and timestamps on the first alternative
    let alt = result.alternatives[0];
    alt.transcript =
      utterance.timestamps
        .map(function(ts) {
          return ts[WORD];
        })
        .join(' ') + ' ';
    alt.timestamps = utterance.timestamps;
    // overwrite the final value
    result.final = final;

    let start = utterance.timestamps[0][1];
    let end = utterance.timestamps[utterance.timestamps.length - 1][2];

    // overwrite the word_alternatives
    if (utterance.result.word_alternatives) {
      let alts = utterance.result.word_alternatives.filter(function(walt) {
        return walt.start_time >= start && walt.end_time <= end;
      });
      result.word_alternatives = alts;
    }

    // overwrite the keywords spotted
    let original_keywords_result = utterance.result.keywords_result;
    if (original_keywords_result) {
      let keywords_result = {};
      Object.keys(original_keywords_result).forEach(function(keyword) {
        let spottings = original_keywords_result[keyword].filter(function(spotting) {
          return spotting.start_time >= start && spotting.end_time <= end;
        });
        if (spottings.length) {
          keywords_result[keyword] = spottings;
        }
      });
      result.keywords_result = keywords_result;
    }

    return result;
  });

  // result_index is always 0 because the results always includes the entire conversation so far.
  return { results: results, result_index: 0 };
}

String.prototype.sentenceCase = function(){
  // const reHesitation = /%HESITATION ?/g;
  // this.trim().replace(reHesitation, ' ');
	return (this.substring(0,1).toUpperCase() + this.substring(1)).trim() + '. ';
}
