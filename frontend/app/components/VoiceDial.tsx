"use client";

import { useState, useRef } from "react";

interface Props {
  onTranscript: (transcript: string) => void;
}

export default function VoiceDial({ onTranscript }: Props) {
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function handleClick() {
    // Fall back to prompt if Web Speech API not available
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      const transcript = prompt("Say what you're looking for:");
      if (transcript) onTranscript(transcript);
      return;
    }

    if (recording) {
      stopRecording();
      return;
    }

    startRecording();
  }

  function startRecording() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
      setRecording(false);
    };

    recognition.onerror = () => {
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
    };

    recognition.start();
    setRecording(true);
  }

  function stopRecording() {
    setRecording(false);
  }

  return (
    <button
      onClick={handleClick}
      className={`fixed bottom-6 right-6 w-16 h-16 rounded-full text-white text-2xl flex items-center justify-center shadow-lg active:scale-95 transition-colors ${
        recording ? "bg-red-500 animate-pulse" : "bg-black"
      }`}
    >
      {recording ? "⏹" : "🎤"}
    </button>
  );
}
