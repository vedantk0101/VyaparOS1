import os
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import speech_recognition as sr
import gtts
import base64
import tempfile

app = FastAPI(title="VyaparOS Free Voice Agent")

# Allow Web App to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

recognizer = sr.Recognizer()

@app.websocket("/ws/voice")
async def voice_websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint that receives audio data, transcribes it, 
    generates an AI response, and streams audio back in real time.
    """
    await websocket.accept()
    print("Client connected to Voice Agent WebSocket")
    
    try:
        while True:
            # Receive audio data from browser
            data = await websocket.receive_text()
            
            # Simple speech response logic (plug your Ollama/LLM here)
            text_lower = data.lower()
            if "gst" in text_lower or "gstr" in text_lower:
                reply_text = "I am ready to help you with your GST filing and record verification."
            elif "invoice" in text_lower:
                reply_text = "Your latest WhatsApp and email invoices have been processed successfully."
            elif "hello" in text_lower or "hi" in text_lower:
                reply_text = "Namaste! I am your VyaparOS AI assistant. How can I help your business today?"
            else:
                reply_text = f"I processed your command: '{data}'. How else can I assist your business?"

            # Convert response text to speech (TTS) using gTTS
            tts = gtts.gTTS(reply_text, lang='en')
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as fp:
                temp_filename = fp.name
                tts.save(temp_filename)

            # Read audio file and encode as base64 to send back to browser
            with open(temp_filename, "rb") as audio_file:
                audio_base64 = base64.b64encode(audio_file.read()).decode('utf-8')
            
            os.remove(temp_filename)

            # Send response back to frontend
            await websocket.send_json({
                "text": reply_text,
                "audio": audio_base64
            })
            
    except WebSocketDisconnect:
        print("Client disconnected from Voice Agent WebSocket")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3001)

@app.post("/api/v1/vapi/webhook")
async def vapi_webhook(payload: dict):
    """
    Vapi sends events here when a phone call starts, updates, or ends.
    """
    event_type = payload.get("message", {}).get("type")
    print(f"📞 Vapi Phone Call Event Received: {event_type}")
    
    if event_type == "end-of-call-report":
        summary = payload.get("message", {}).get("summary", "No summary")
        print(f"Call Summary from AI Bot: {summary}")
        
    return {"status": "success"}