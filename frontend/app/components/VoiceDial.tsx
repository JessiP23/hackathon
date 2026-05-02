"use client";

import { useState } from "react";

type SpeechRecognitionCtor = new () => SpeechRecognition;

interface SpeechRecognitionEventLike {
  results: {
    [key: number]: {
      [key: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
}

interface SpeechWindow extends Window {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

interface Props {
  onTranscript: (transcript: string) => void;
  /** Inline with search bar; omit fixed bottom-right positioning */
  className?: string;
  disabled?: boolean;
  variant?: "dark" | "light";
}

export default function VoiceDial({ onTranscript, className, disabled, variant = "dark" }: Props) {
  const [recording, setRecording] = useState(false);

  async function handleClick() {
    if (disabled) return;
    // Fall back to prompt if Web Speech API not available
    const speechWindow = window as SpeechWindow;
    if (!speechWindow.webkitSpeechRecognition && !speechWindow.SpeechRecognition) {
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
      (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
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

  const base =
    "shrink-0 w-14 h-14 rounded-full text-xl flex items-center justify-center shadow-lg active:scale-95 transition-colors disabled:opacity-40 disabled:pointer-events-none";

  const idle =
    variant === "light"
      ? "border border-black/[0.1] bg-[var(--color-parchment)] text-[var(--color-ink)] hover:bg-white"
      : "border border-white/10 bg-neutral-900 text-white hover:bg-neutral-800";

  return (
    <button
      type="button"
      aria-label={recording ? "Stop listening" : "Search by voice"}
      disabled={disabled}
      onClick={handleClick}
      className={`${base} ${recording ? "border border-red-400/40 bg-red-500 animate-pulse text-white" : idle} ${className ?? ""}`}
    >
      {recording ? "⏹" : "🎤"}
    </button>
  );
}
