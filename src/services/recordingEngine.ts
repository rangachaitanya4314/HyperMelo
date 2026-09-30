// Recording Engine with real MediaRecorder and graceful simulated fallback

export interface RecordingSession {
  isSimulated: boolean;
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

  public async startRecording(): Promise<{ isSimulated: boolean }> {
    this.audioChunks = [];
    this.isRecording = true;
    this.startTime = Date.now();

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);

        this.mediaRecorder = new MediaRecorder(this.mediaStream);
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };
        this.mediaRecorder.start(100);
        return { isSimulated: false };
      }
    } catch {
      // Permission denied or no mic, fallback to simulated recording
      // Will handle in simulated mode cleanly
    }

    return { isSimulated: true };
  }

  public getMicLevel(): number {
    if (!this.analyser) {
      // Return simulated subtle flutter
      return 0.35 + Math.sin(Date.now() / 150) * 0.25 + Math.random() * 0.15;
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

  public async stopRecording(): Promise<RecordingSession> {
    const duration = (Date.now() - this.startTime) / 1000;
    this.isRecording = false;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      return new Promise((resolve) => {
        if (!this.mediaRecorder) {
          resolve({ isSimulated: true, duration });
          return;
        }
        this.mediaRecorder.onstop = () => {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          const audioBlobUrl = URL.createObjectURL(audioBlob);
          this.cleanupMedia();
          resolve({
            isSimulated: false,
            audioBlob,
            audioBlobUrl,
            duration
          });
        };
        this.mediaRecorder.stop();
      });
    }

    this.cleanupMedia();
    return {
      isSimulated: true,
      duration
    };
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
