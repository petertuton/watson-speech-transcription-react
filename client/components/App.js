import React, { Component } from 'react';
import Dropzone from 'react-dropzone';
import ReactAudioPlayer from 'react-audio-player';
import TextField from '@material-ui/core/TextField';
import DownloadLink from "react-download-link";
import RecognitionJob from '../lib/recognition-job';

// Contants
// TODO: Pass these as parameters via the UI
const STT_URL='https://gateway-syd.watsonplatform.net/speech-to-text/api';
const STT_MODEL='en-US_NarrowbandModel';
const STT_LANGUAGE_CUSTOMISATION_ID='601ff8ed-f9b9-4d21-b41b-e1e915781e99';
const STT_ACOUSTIC_CUSTOMISATION_ID='83739a0b-5b4a-4df8-b360-bba5ceb8af8a';
const CHECKSTATUS_INTERVAL=5000;

class App extends Component {

  constructor(props) {
    super(props);

    // Initialise the state
    this.state = { 
      url: STT_URL,
      model: STT_MODEL,
      language_customization_id: STT_LANGUAGE_CUSTOMISATION_ID,
      acoustic_customization_id: STT_ACOUSTIC_CUSTOMISATION_ID,
      recognitionJobs: [],
      selectedJob: null,
      transcription: ''
    };
  }

  // componentDidMount() {
  // }
  
  componentWillUnmount() {
    clearInterval(this.intervalId);
  }

  //////////////////
  // 
  // checkJobs - Calls STT via the server in async mode to check all job statuses
  // 
  checkJobs() {
    // Check any recognition jobs that are still processing 
    // TODO: Removing async calls, for now... 
    // this.state.recognitionJobs.filter(recognitionJob => recognitionJob.isProcessing()).map(processingJob => {
    //   processingJob.checkJob();
    // });

    // Force a rerender to ensure any updated jobs are rendered
    this.forceUpdate();
  }

  //////////////////
  // 
  // onDrop - called when files are dropped into <Dropzone>
  // 
  onDrop(files) {
    // Create a new recognition job array containing each file in the dropzone
    let recognitionJobs = [];
    files.forEach((file) => recognitionJobs.push(new RecognitionJob(file, this.state.url, this.state.model, this.state.language_customization_id, this.state.acoustic_customization_id)));

    // Do we need to release any memory used by the previous recognitionJobs files object? 

    // Set the state to include the new array, clear the selected job and transcription
    this.setState({
      recognitionJobs,
      selectedJob: null,
      transcription: ''
    });

    // Start the interval to refresh the recognition job status's
    // TODO: when not running on localhost, change this to a websocket to collect updates from the server rather than periodic checks
    this.intervalId = setInterval(this.checkJobs.bind(this), CHECKSTATUS_INTERVAL);
  }

  //////////////////
  // 
  // onSelect - called when the transcribe/processing/completed button is clicked
  // 
  onSelect(recognitionJob) {
    // Perform the action relative to thestatus of the selected file/job
    switch (recognitionJob.status) {
      
      // Job not started - create a new job
      case recognitionJob.STATUS_NOTSTARTED:
        // TODO: process the file using either async or websocket, based on the size limitations and/or an option
        // Async-based transcription - doesn't return results
        // recognitionJob.createJob();
        // Websocket-based transcription
        recognitionJob.transcribe();
        break;

      // Still processing...
      case recognitionJob.STATUS_PROCESSING:
        break;

      // Job completed
      case recognitionJob.STATUS_COMPLETED:
        break;
      
      default:
        // For anything else, do nothing
        break;
    }

    // Update the UI with the selected job
    this.setState({
      selectedJob: recognitionJob
    });
  }

  //////////////////
  // 
  // onTranscriptionChange - called when the transcription text is editted by the user
  // 
  onTranscriptionChange(event) {
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
          onDrop={this.onDrop.bind(this)}>
            <p> 
              Drop your audio file here, or click to select the file to upload.
              Supported audio types include: .wav, .mp3, .ogg, .opus, .flac, and .webm
            </p>
        </Dropzone>
        <aside>
          <ul>{this.state.recognitionJobs.map((job,index) => <li key={job.file.name}><button className='button-select' onClick={this.onSelect.bind(this, job)}>{job.status}</button> {job.file.name} ({job.file.type})</li>)}
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
          onChange={this.onTranscriptionChange.bind(this)} 
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