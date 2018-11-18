import WatsonSpeech from '../lib/watson-speech';

// Contants
const STT_AUTHURL='/api/token';

export default class FileRecognition {
  
  constructor(file, token, url, model, language_customization_id, acoustic_customization_id) {
    this.STATUS_NOTSTARTED = 'transcribe';
    this.STATUS_PROCESSING = 'processing';
    this.STATUS_COMPLETED = 'completed';

    this.file=file;
    this.url=url;
    this.token=token;
    this.model=model;
    this.language_customization_id=language_customization_id;
    this.acoustic_customization_id=acoustic_customization_id;
    
    this.id = null;
    this.created = '';
    this.status = this.STATUS_NOTSTARTED;
    this.updated = '';
    this.results = '';
    this.transcription = 'Processing... results may take a few moments to return';
  }  
  
  isProcessing() {
    return this.status == this.STATUS_PROCESSING;
  };

  isComplete() {
    return this.status == this.STATUS_COMPLETED;
  };
  
  //////////////////
  // 
  // transcribe - Calls STT via WebSockets
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
        this.status = this.STATUS_COMPLETED;
      }.bind(this));
  
      stream.on('stop', function() {
        console.log('Transcription stopped:',this.file.name);
      }.bind(this));
  
      stream.on('finish', function() {
        console.log('Transcription finished:',this.file.name);
        this.status = this.STATUS_COMPLETED;
      }.bind(this));
    }
    catch (error) {
      console.error(error);
      this.status = this.STATUS_COMPLETED;
      this.transcription = 'Transcription error: ' + error;
    }
  }
}
