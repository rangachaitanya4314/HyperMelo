// Real Microphone Recording Engine for NARO
// Uses navigator.mediaDevices.getUserMedia() and MediaRecorder
// Honest error handling with zero simulation of recording or fabricated metrics

export interface StartRecordingResult {
  success: boolean;
  error?: 'denied' | 'not_found' | 'unsupported' | 'unknown';
  errorMessage?: string;
}

export interface StopRecordingResult {
  success: boolean;
  audioBlob?: Blob;
  audioBlobUrl?: string;
  duration: number;
}

class RecordingEngine {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isRecording = false;
  private startTime = 0;

  public get recordingState(): boolean {
    return this.isRecording;
  }

  public async startRecording(): Promise<StartRecordingResult> {
    this.audioChunks = [];
    this.startTime = Date.now();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return {
        success: false,
        error: 'unsupported',
        errorMessage: 'Microphone recording is not supported in this browser.'
      };
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;
      source.connect(this.analyser);

      // Choose supported mimeType
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg')
        ? 'audio/ogg'
        : '';

      this.mediaRecorder = mimeType
        ? new MediaRecorder(this.mediaStream, { mimeType })
        : new MediaRecorder(this.mediaStream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;
      return { success: true };
    } catch (err: unknown) {
      this.cleanupMedia();
      this.isRecording = false;

      const error = err as { name?: string; message?: string };
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        return {
          success: false,
          error: 'denied',
          errorMessage: 'Microphone permission is required to record your moment.'
        };
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        return {
          success: false,
          error: 'not_found',
          errorMessage: 'No microphone was found on this device.'
        };
      }

      return {
        success: false,
        error: 'unknown',
        errorMessage: error.message || 'Unable to access microphone.'
      };
    }
  }

  public getMicLevel(): number {
    if (!this.analyser) {
      return 0;
    }
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const avg = sum / data.length;
    return Math.min(1, avg / 128);
  }

  public async stopRecording(): Promise<StopRecordingResult> {
    const duration = Math.max(0.5, (Date.now() - this.startTime) / 1000);
    this.isRecording = false;

    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      this.cleanupMedia();
      return { success: false, duration };
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve({ success: false, duration });
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        const audioBlobUrl = URL.createObjectURL(audioBlob);
        this.cleanupMedia();

        resolve({
          success: true,
          audioBlob,
          audioBlobUrl,
          duration
        });
      };

      try {
        this.mediaRecorder.stop();
      } catch {
        this.cleanupMedia();
        resolve({ success: false, duration });
      }
    });
  }

  public cancelRecording(): void {
    this.isRecording = false;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    this.cleanupMedia();
  }

  private cleanupMedia() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
  }
}

export const recordingEngine = new RecordingEngine();
