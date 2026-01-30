"use client";

interface Props {
  onTranscript: (transcript: string) => void;
}

export default function VoiceDial({ onTranscript }: Props) {
  async function handleClick() {
    const transcript = prompt("Say what you're looking for:");
    if (transcript) onTranscript(transcript);
  }

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-black text-white text-2xl flex items-center justify-center shadow-lg active:scale-95"
    >
      🎤
    </button>
  );
}
