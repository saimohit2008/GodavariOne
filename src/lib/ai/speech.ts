// Godavari One — Browser-Native Voice Input & Speech Synthesis
// Zero third-party paid speech APIs. Uses standard W3C Web Speech API.

export interface SpeechRecognitionResultState {
  transcript: string;
  isFinal: boolean;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.speechSynthesis);
}

export function createSpeechRecognizer(opts: {
  language: "en" | "te";
  onResult: (result: SpeechRecognitionResultState) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}) {
  if (!isSpeechRecognitionSupported()) {
    opts.onError("Speech recognition is not supported in this browser. Please use keyboard input.");
    return null;
  }

  const SpeechRecognitionClass =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  const recognition = new SpeechRecognitionClass();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = opts.language === "te" ? "te-IN" : "en-IN";

  recognition.onresult = (event: any) => {
    let finalTranscript = "";
    let interimTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    opts.onResult({
      transcript: finalTranscript || interimTranscript,
      isFinal: Boolean(finalTranscript),
    });
  };

  recognition.onerror = (event: any) => {
    let errorMsg = "Microphone error occurred.";
    if (event.error === "not-allowed") {
      errorMsg = "Microphone access was denied. Please allow microphone permissions in browser settings.";
    } else if (event.error === "no-speech") {
      errorMsg = "No speech detected. Please try speaking again.";
    }
    opts.onError(errorMsg);
  };

  recognition.onend = () => {
    opts.onEnd();
  };

  return recognition;
}

export function speakText(
  text: string,
  language: "en" | "te",
  onEnd?: () => void
): boolean {
  if (!isSpeechSynthesisSupported()) return false;

  window.speechSynthesis.cancel(); // Stop any currently playing audio

  // Strip markdown symbols and URLs for clean speech
  const cleanText = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_#`~>]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .slice(0, 400); // Read first concise paragraph

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = language === "te" ? "te-IN" : "en-IN";
  utterance.rate = 0.95;

  // Try to pick suitable localized voice
  const voices = window.speechSynthesis.getVoices();
  const targetVoice = voices.find((v) =>
    language === "te"
      ? v.lang.startsWith("te")
      : v.lang.startsWith("en-IN") || v.lang.startsWith("en-")
  );

  if (targetVoice) {
    utterance.voice = targetVoice;
  }

  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }

  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}
