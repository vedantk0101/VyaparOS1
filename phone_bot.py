import os
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import gtts
import base64
import tempfile

app = FastAPI(title="VyaparOS Inbound Phone AI Bot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws/phone-call")
async def phone_call_websocket(websocket: WebSocket):
    """
    Handles live audio streams coming from a mobile phone call 
    via a free SIP/WebRTC gateway (like Linphone or WebRTC softphone).
    """
    await websocket.accept()
    print("📞 Incoming mobile phone call connected to AI Bot!")
    
    # 1. Send opening greeting as soon as the client picks up
    welcome_msg = "Namaste! Welcome to VyaparOS. How can I help you with your business or payment status today?"
    audio_b64 = text_to_speech_base64(welcome_msg)
    
    await websocket.send_json({
        "text": welcome_msg,
        "audio": audio_b64
    })

    try:
        while True:
            # 2. Receive spoken words transcribed from the caller's phone audio
            data = await websocket.receive_text()
            print(f"Caller Said: {data}")
            
            # 3. AI Agent logic for client queries
            query = data.lower()
            if "gst" in query or "return" in query:
                reply = "You can file your GST return through the official portal. I can open the GST website for you right now if you wish."
            elif "payment" in query or "due" in query:
                reply = "Your payment details have been logged in VyaparOS. We will update your ledger shortly."
            elif "hello" in query or "hi" in query:
                reply = "Hello! I am your AI assistant listening live from VyaparOS. What would you like to check?"
            else:
                reply = f"I noted your statement regarding {data}. Is there anything else about your business I can help with?"

            # 4. Generate audio reply
            reply_audio_b64 = text_to_speech_base64(reply)

            # 5. Send back response text and voice audio to the caller
            await websocket.send_json({
                "text": reply,
                "audio": reply_audio_b64
            })
            
    except WebSocketDisconnect:
        print("📴 Mobile phone call ended.")

def text_to_speech_base64(text: str) -> str:
    """Helper to convert AI text response into playable MP3 base64 audio"""
    tts = gtts.gTTS(text, lang='en')
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as fp:
        temp_name = fp.name
        tts.save(temp_name)
    
    with open(temp_name, "rb") as f:
        encoded = base64.b64encode(f.read()).decode('utf-8')
    os.remove(temp_name)
    return encoded

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3002)