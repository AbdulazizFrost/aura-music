/**
 * VoiceService — Real Speech Recognition for Voice Search.
 * Uses Web Speech API (SpeechRecognition / webkitSpeechRecognition).
 */
class VoiceService {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.isSupported = false;
    this._init();
  }

  _init() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.isSupported = true;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'ru-RU';
    }
  }

  startListening(onResult, onError, onEnd) {
    if (!this.isSupported || !this.recognition) {
      if (onError) onError({ code: 'NOT_SUPPORTED', message: 'Голосовой поиск не поддерживается на данном устройстве.' });
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }

    this.recognition.onstart = () => {
      this.isListening = true;
    };

    this.recognition.onresult = (event) => {
      this.isListening = false;
      if (event.results && event.results.length > 0) {
        const transcript = event.results[0][0].transcript;
        if (onResult) onResult(transcript);
      }
    };

    this.recognition.onerror = (err) => {
      this.isListening = false;
      if (onError) onError(err);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (onEnd) onEnd();
    };

    try {
      this.recognition.start();
    } catch (e) {
      this.isListening = false;
      if (onError) onError(e);
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VoiceService;
}
