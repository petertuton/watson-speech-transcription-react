import WatsonSpeech from '../lib/watson-speech';

export default class FileRecognition {
  
  constructor(file, token, url, model, language_customization_id, acoustic_customization_id) {
    this.STATUS_NOTSTARTED = 'transcribe';
    this.STATUS_PROCESSING = 'processing';
    this.STATUS_COMPLETED = 'completed';

    this.status = this.STATUS_NOTSTARTED;
    this.transcription = 'Processing... results may take a few moments to return';

    this.file=file;
    this.token=token;
    this.url=url;
    this.model=model;
    this.language_customization_id=language_customization_id;
    this.acoustic_customization_id=acoustic_customization_id;

    this.stream = null;
  }  
  
  isProcessing() {
    return this.status == this.STATUS_PROCESSING;
  };

  isComplete() {
    return this.status == this.STATUS_COMPLETED;
  };
  
  //////////////////
  // 
  // transcribe - Calls Watson STT via WebSockets
  // 
  transcribe() {
    // Set the status to processing
    this.status = this.STATUS_PROCESSING;
    
    try {
      console.log('Transcription started:',this.file.name);
        
      let stream = WatsonSpeech.SpeechToText.recognizeFile({
        access_token: this.token,
        file: this.file.preview,
        play: false,
        format: true,
        realtime: false,
        resultsBySpeaker: true,

        language_customization_id: this.language_customization_id,
        acoustic_customization_id: this.acoustic_customization_id,

        model: this.model,
        url: this.url,

        'X-Watson-Learning-Opt-Out': true
      });

      stream.on('data', this._onStreamData);
      stream.on('error', this._onStreamError);
      stream.on('stop', this._onStreamStop);
      stream.on('finish', this._onStreamFinish);
  
      this.stream = stream;
    }
    catch (error) {
      console.error(error);
      this.status = this.STATUS_COMPLETED;
      this.transcription = 'Transcription error: ' + error;
    }
  }

  stop() {
    if (this.stream) {
      console.log("Stopping:",this.file.name);
      this.stream.stop();
    }
  }

  _onStreamData = (data) => {
    let lines = data.results.map(function(result) {
      return 'Speaker ' + result.speaker + ': ' + result.alternatives[0].transcript;
    });
    // TODO: Replace 'Speaker x' with an actual name, provided by the user via the UI
    let transcription = lines.join('\n');

    // Update the selected job's running transcription
    this.transcription = transcription;
  }

  _onStreamError = (error) => {
    console.error(error);
    this.transcription = 'Transcription error: ' + error;
    this.status = this.STATUS_COMPLETED;
  }

  _onStreamStop = () => {
    console.log('Transcription stopped:',this.file.name);
  }

  _onStreamFinish = () => {
    console.log('Transcription finished:',this.file.name);
  }
}
