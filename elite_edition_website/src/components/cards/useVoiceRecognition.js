import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Supported floor languages for Indian manufacturing environments.
 */
export const SUPPORTED_VOICE_LANGUAGES = [
  { code: 'en-IN', label: 'English (IN)', flag: '🇮🇳' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'gu-IN', label: 'ગુજરાતી (Gujarati)', flag: '🇮🇳' }
];

/**
 * Custom hook providing Web Speech Recognition for ERP Copilot.
 * Tailored for textile shop-floor environments with noise tolerance & multi-lingual dictation.
 */
export function useVoiceRecognition({ onTranscript, onFinalSpeech }) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en-IN');
  const [interimText, setInterimText] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);

  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (SpeechRecognition) {
      setIsSupported(true);
    } else {
      setIsSupported(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    setIsListening(false);
    setInterimText('');
  }, []);

  const startListening = useCallback(() => {
    setErrorMsg(null);
    const SpeechRecognition =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognition) {
      setErrorMsg('Voice recognition not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_) {}
      }

      const recognition = new SpeechRecognition();
      recognition.lang = selectedLang;
      recognition.interimResults = true;
      recognition.continuous = false; // Stop when operator pauses speech
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setInterimText('');
      };

      recognition.onresult = (event) => {
        let interim = '';
        let finalStr = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0]?.transcript || '';
          if (item.isFinal) {
            finalStr += text;
          } else {
            interim += text;
          }
        }

        if (interim) {
          setInterimText(interim);
          if (onTranscript) onTranscript(interim, false);
        }

        if (finalStr) {
          setInterimText('');
          if (onTranscript) onTranscript(finalStr, true);
          if (onFinalSpeech) onFinalSpeech(finalStr.trim());
        }
      };

      recognition.onerror = (event) => {
        console.warn('[useVoiceRecognition error]:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMsg('Microphone access blocked. Please allow mic permissions in browser settings.');
        } else if (event.error === 'no-speech') {
          setErrorMsg('No speech detected. Please speak closer to the microphone.');
        } else if (event.error !== 'aborted') {
          setErrorMsg(`Voice input error: ${event.error}`);
        }
        setIsListening(false);
        setInterimText('');
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimText('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('[useVoiceRecognition start error]:', err);
      setErrorMsg('Could not initialize microphone: ' + err.message);
      setIsListening(false);
    }
  }, [selectedLang, onTranscript, onFinalSpeech]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    selectedLang,
    setSelectedLang,
    interimText,
    errorMsg,
    startListening,
    stopListening,
    toggleListening
  };
}
