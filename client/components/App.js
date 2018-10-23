import React, { Component } from 'react';
import Dropzone from 'react-dropzone';
import ReactAudioPlayer from 'react-audio-player';
import Textarea from 'react-textarea-autosize';
import DownloadLink from "react-download-link";
import WatsonSpeech from 'watson-speech';

// Contants
const STT_AUTHURL='/api/token';
// TODO: Allow these values to be entered into the UI, with defaults? 
const STT_URL='https://gateway-syd.watsonplatform.net/speech-to-text/api';
const STT_MODEL='en-US_NarrowbandModel';
const STT_LANGUAGE_CUSTOMISATION_ID='af031a6a-9be3-4ef6-9864-1b7ea0c23aea';
const STT_ACOUSTIC_CUSTOMISATION_ID='082ad887-826c-49c8-a19c-a30110f4d43a';

class App extends Component {

  //////////////////
  // Constructor
  //////////////////
  constructor(props) {
    super(props);

    // Initialise the state
    this.state = { 
      token: '',
      files: [],
      selected_file: null,
      processing: false,
      transcription: ''
    };
  }
  
  //////////////////
  // Destructor 
  //////////////////
  componentWillUnmount() {
    // Clear memory used by file's object url
    this.cleanMemory();
  }

  //////////////////
  // Methods
  //////////////////
  // 
  // getToken - Requests an authentication token from the server-side component issuing tokens
  //            Returns a -Promise- when the token is provided by the auth server
  getToken() {
    return fetch(STT_AUTHURL).then(function(response) {
      return response.text();
    });
  }

  //////////////////
  // 
  // cleanMemory - each file dropped into the dropzone requires memory cleanup
  // 
  cleanMemory() {
    if (this.state.files.length > 0) {
      this.state.files.map(file => URL.revokeObjectURL(file.preview));
    }
  }

  //////////////////
  // Events
  //////////////////
  // 
  // onDrop - called when files are dropped into <Dropzone>
  // 
  onDrop(files) {
    // First clean any memory used by any previous file drops
    this.cleanMemory();

    // Set the state to include the dropped files
    this.setState({
      files
    });
  }

  //////////////////
  // 
  // onTranscribe - called when the 'transcribe' button is clicked
  //              - calls Watson STT to transcribe the provided file (URL)
  // 
  onTranscribe(file) {
    this.setState({
      isProcessing: true,
      transcription: 'Processing... It may take a few moments for the transcription to start',
      selected_file: file
    });

    // First get an authentication token, then process the file
    this.getToken().then(function(token) {
      console.log('Transcription started');

      // let recognizeFile = require('watson-speech/speech-to-text/recognize-file');
      let stream = WatsonSpeech.SpeechToText.recognizeFile({
        model: STT_MODEL,
        url: STT_URL,
        access_token: token,
        smart_formatting: true,
        language_customization_id: STT_LANGUAGE_CUSTOMISATION_ID,
        acoustic_customization_id: STT_ACOUSTIC_CUSTOMISATION_ID, 
        file: file.preview,
        play: false,
        format: true,
        realtime: false,
        speaker_labels: true,
        resultsBySpeaker: true
      });
  
      stream.on('data', function(data) {
        let lines = data.results.map(function(result) {
          return 'Speaker ' + result.speaker + ': ' + result.alternatives[0].transcript;
        });
        // TODO: Replace 'Speaker x' with an actual name, provided by the user via the UI
        let transcription = lines.join('\n');

        // Update the transcription text
        this.setState({
          isProcessing: true,
          transcription
        });
      }.bind(this));

      stream.on('error', function(error) {
        console.log('Transcription error: ', error);
        this.setState({
          isProcessing: false,
          transcription: 'Transcription error: ' + error
        });
      }.bind(this));
  
      stream.on('stop', function() {
        console.log('Transcription stopped')
        this.setState({
          isProcessing: false
        });
      }.bind(this));
  
      stream.on('finish', function() {
        console.log('Transcription finished')
        this.setState({
          isProcessing: false
        });
      }.bind(this));
    }.bind(this));
  }

  //////////////////
  // 
  // onTranscriptionChange - called when the transcription text is editted by the user
  // 
  onTranscriptionChange(event) {
    // Check the processing state 
    if (!this.state.isProcessing) {
      // Update the transcription text
      this.setState({
        transcription: event.target.value
      });
    }
  }

  //////////////////
  // render
  // 
  render() {
    return (
      <div>
        <h1>Watson Speech Transcription</h1>

        <Dropzone 
          className='dropzone'
          // Accepting file doesn't appear to work how I expect it to work... 
          // accept="audio/basic, audio/flac, audio/l16, audio/mp3, audio/mulaw, audio/ogg, audio/wav, audio/webm"
          onDrop={this.onDrop.bind(this)}>
            <p> 
              Drop your audio file here, or click to select the file to upload.
              Supported audio types include: .wav, .mp3, .ogg, .opus, .flac, and .webm
            </p>
        </Dropzone>
        <aside>
          <ul>{this.state.files.map(file => <li key={file.name}><button className='button-transcribe' onClick={this.onTranscribe.bind(this, file)}>Transcribe</button> {file.name} ({file.type})</li>)}</ul>
        </aside>
        <ReactAudioPlayer controls src={this.state.selected_file ? this.state.selected_file.preview : null} />
        <Textarea 
          minRows={10} 
          maxRows={20} 
          value={this.state.transcription} 
          onChange={this.onTranscriptionChange.bind(this)} 
          disabled={this.state.isProcessing}
        />
        <DownloadLink
          filename={this.state.selected_file ? this.state.selected_file.name + '.txt' : null}
          exportFile={() => this.state.transcription}
          tagName='button'
          className='button-save'
          style={{}}
          />
        {/* Add some style to this...  */}
        {this.state.isProcessing ? ' Processing...' : ''}
        {!this.state.isProcessing && this.state.selected_file ? ' Transcription complete' : ''}
      </div>
    )
  }
}

export default App