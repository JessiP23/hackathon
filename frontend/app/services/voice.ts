import axios from "axios";
import { VoiceResponse } from "../shared/types";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function sendVoiceTranscript(
  transcript: string,
  lat: number,
  lng: number
): Promise<VoiceResponse> {
  const res = await axios.post(`${BASE_URL}/voice`, { transcript, lat, lng });
  return res.data;
}