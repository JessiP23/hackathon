import { getVendorsNearby } from "./api";

export async function sendVoiceTranscript(transcript: string, lat: number, lng: number) {
  // For now, just call backend search
  return getVendorsNearby(transcript, lat, lng);
}
