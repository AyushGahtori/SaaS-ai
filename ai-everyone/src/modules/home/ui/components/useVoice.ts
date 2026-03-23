'use client'

import { useState, useRef } from "react"

export type VoiceState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"

export default function useVoice(onTranscript: (text: string)=>void) {

  const [state,setState] = useState<VoiceState>("idle")

  const recognitionRef = useRef<any>(null)

  const startListening = () => {

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    const recognition = new SpeechRecognition()

    recognition.lang = "en-US"
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => {
      setState("listening")
    }

    recognition.onresult = (event:any) => {

      const text = event.results[0][0].transcript

      setState("processing")

      onTranscript(text)
    }

    recognition.onend = () => {
      if(state === "listening") setState("idle")
    }

    recognition.start()

    recognitionRef.current = recognition
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
  }

  const speak = (text:string) => {

    const utterance = new SpeechSynthesisUtterance(text)

    utterance.onstart = () => setState("speaking")

    utterance.onend = () => setState("idle")

    speechSynthesis.speak(utterance)
  }

  return {
    state,
    startListening,
    stopListening,
    speak
  }
}