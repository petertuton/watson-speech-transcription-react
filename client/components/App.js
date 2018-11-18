import React, { Component } from 'react';
import Dropzone from 'react-dropzone';
import ReactAudioPlayer from 'react-audio-player';
import TextField from '@material-ui/core/TextField';
import DownloadLink from "react-download-link";
import FileRecognition from './file-recognition';

// Contants
const API_CONFIG='/api/config';
const API_TOKEN='/api/token';
const INTERVAL_TOKEN=3600000;     // 1 hour
const INTERVAL_FORCEUPDATE=5000;  // 5 seconds


class App extends Component {

  constructor(props, context) {
    super(props, context);

    // Initialise the state
    this.state = { 
      url: '',
      model: '',
      language_customization_id: '',
      acoustic_customization_id: '',
      token: null,
      fileRecognitions: [],
      selectedJob: null,
      transcription: ''
    };
  }

  componentDidMount() {
    // Get the config used by the server and set the state's configuration accordingly
    this._getConfig().then((config) => {
      console.log("Server configuration:",JSON.stringify(config));
      this.setState({ 
        url: config.url,
        model: config.model,
        language_customization_id: config.language_customization_id,
        acoustic_customization_id: config.acoustic_customization_id
      });
    });

    // Get an authentication token from the server
    this._getToken().then((token) => {
        this.setState({ token });
        // Set the token's refresh interval
        this.intervalToken = setInterval(this._getToken, INTERVAL_TOKEN);
    });
  }
  
  componentWillUnmount() {
    clearInterval(this.intervalToken);
    clearInterval(this.intervalForceUpdate);
  }

  //////////////////
  // 
  // _getConfig - Requests the configuration used by the server-side component
  //
  _getConfig() {
    console.log("Requesting server configuration");
    return fetch(API_CONFIG)
      .then(response => response.json())
      .catch(error => console.error(error));
  }

  //////////////////
  // 
  // _getToken - Requests an authentication token from the server-side component
  //
  _getToken() {
    console.log("Requesting authentication token");
    return fetch(API_TOKEN)
      .then(response => response.text())
      .catch(error => console.error(error));
  }

  //////////////////
  // 
  // _checkJobs - Forces a render to ensure any transcriptions are picked-up
  // 
  _checkJobs = () => {
    // Force a rerender to ensure any updated jobs are rendered
    this.forceUpdate();
  }

  //////////////////
  // 
  // onDrop - called when files are dropped into <Dropzone>
  // 
  onDrop = (files) => {
    // Create a new recognition job array containing each file in the dropzone
    let fileRecognitions = [];
    files.forEach((file) => fileRecognitions.push(new FileRecognition(
                                                      file, 
                                                      this.state.token,
                                                      this.state.url, 
                                                      this.state.model, 
                                                      this.state.language_customization_id, 
                                                      this.state.acoustic_customization_id
                                                    )));

    // Do we need to release any memory used by the previous fileRecognitions files object? 

    // Set the state to include the new array, clear the selected job and transcription
    this.setState(function(prevState,props) {
      // Stop any previous jobs that were processing
      prevState.fileRecognitions.filter((job) => job.isProcessing()).forEach((job) => job.stop());
      return {
        fileRecognitions,
        selectedJob: null,
        transcription: ''
      }
    });

    // Start the interval to refresh the recognition job status's
    this.intervalForceUpdate = setInterval(this._checkJobs, INTERVAL_FORCEUPDATE);
  }

  //////////////////
  // 
  // onSelect - called when the transcribe/processing/completed button is clicked
  // 
  onSelect = (fileRecognition) => {
    // Perform the action relative to thestatus of the selected file/job
    switch (fileRecognition.status) {
      
      // Job not started - create a new job
      case fileRecognition.STATUS_NOTSTARTED:
        // Websocket-based transcription
        fileRecognition.transcribe();
        break;

      // Still processing...
      case fileRecognition.STATUS_PROCESSING:
        break;

      // Job completed
      case fileRecognition.STATUS_COMPLETED:
        break;
      
      default:
        // For anything else, do nothing
        break;
    }

    // Update the UI with the selected job
    this.setState({
      selectedJob: fileRecognition
    });
  }

  //////////////////
  // 
  // onTranscriptionChange - called when the transcription text is editted by the user
  // 
  onTranscriptionChange = (event) => {
    let transcription = event.target.value;
    let selectedJob = this.state.selectedJob;
    
    // Update the selected job's transcription
    selectedJob.transcription = transcription;

    // Update the UI's transcription
    this.setState({
      selectedJob,
      transcription
    });
  }

  //////////////////
  //
  // render
  // 
  render() {
    let selectedJob = this.state.selectedJob;
    let isSelectedJobComplete = selectedJob && selectedJob.isComplete() ? true : false;

    return (
      <div>
        <h1>Watson Speech Transcription</h1>

        <Dropzone 
          id='dropzone'
          className='dropzone'
          // Accepting file doesn't appear to work how I expect it to work... 
          // accept="audio/basic, audio/flac, audio/l16, audio/mp3, audio/mulaw, audio/ogg, audio/wav, audio/webm"
          onDrop={this.onDrop}>
            <p> 
              Drop your audio file here, or click to select the file to upload.
              Supported audio types include: .wav, .mp3, .ogg, .opus, .flac, and .webm
            </p>
        </Dropzone>
        <aside>
          <ul>{this.state.fileRecognitions.map((job,index) => <li key={job.file.name}><button className='button-select' onClick={this.onSelect.bind(this, job)}>{job.status}</button> {job.file.name} ({job.file.type})</li>)}
          </ul>
        </aside>
        <ReactAudioPlayer 
          id='audioplayer'
          className='audioplayer'
          controls src={selectedJob ? selectedJob.file.preview : null} 
        />
        <TextField 
          id='transcription'
          // label="Transcription"
          className='transcription'
          variant='outlined'
          multiline
          fullWidth={true}
          rows={10}
          rowsMax={20} 
          value={selectedJob ? selectedJob.transcription: ''} 
          disabled={!isSelectedJobComplete}
          onChange={this.onTranscriptionChange} 
        />
        <DownloadLink
          id='button-save'
          className='button-save'
          tagName='button'
          filename={selectedJob != null ? selectedJob.file.name + '.txt' : null}
          exportFile={() => selectedJob.transcription}
          style={{}}
          />
      </div>
    )
  }
}

export default App