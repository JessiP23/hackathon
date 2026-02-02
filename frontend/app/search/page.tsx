"use client";

import { useEffect, useState } from "react";
import { getCurrentLocation } from "@/app/services/location";
import { sendVoiceTranscript } from "@/app/services/voice";
import VoiceDial from "@/app/components/VoiceDial";
import MapView from "@/app/components/MapView";
import VendorCard from "@/app/components/VendorCard";
import { Vendor, Location, VoiceResponse } from "@/app/shared/types";

export default function SearchPage() {
  const [location, setLocation] = useState<Location | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState("");

  useEffect(() => {
    getCurrentLocation()
      .then(setLocation)
      .catch(() => {
        setMessage("Please enable location to find vendors nearby");
      });
  }, []);

  async function handleVoice(text: string) {
    if (!location) {
      setMessage("Location not available");
      return;
    }

    setTranscript(text);
    setLoading(true);
    setMessage("");

    try {
      const res: VoiceResponse = await sendVoiceTranscript(text, location.lat, location.lng);
      setVendors(res.results || []);
      setMessage(res.message);

      // Speak response (optional TTS)
      if ("speechSynthesis" in window && res.message) {
        const utterance = new SpeechSynthesisUtterance(res.message);
        utterance.rate = 1.1;
        speechSynthesis.speak(utterance);
      }
    } catch (err) {
      setMessage("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen pb-24 text-black">
      <MapView vendors={vendors} userLocation={location} />

      <div className="p-4 space-y-3">
        {transcript && (
          <div className="text-sm text-gray-500">
            You said: "{transcript}"
          </div>
        )}

        {loading && (
          <div className="text-sm text-gray-500 animate-pulse">
            Searching nearby vendors...
          </div>
        )}

        {message && !loading && (
          <div className="text-sm font-medium">{message}</div>
        )}

        {vendors.length === 0 && !loading && !message && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🎤</div>
            <div>Tap the mic and say what you're looking for</div>
            <div className="text-sm mt-1">Try "tacos" or "coffee"</div>
          </div>
        )}

        {vendors.map((v) => (
          <VendorCard key={v.vendorId} vendor={v} />
        ))}
      </div>

      <VoiceDial onTranscript={handleVoice} />
    </main>
  );
}