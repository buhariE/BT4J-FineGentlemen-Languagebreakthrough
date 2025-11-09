import os, io, re, certifi, tempfile
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from dotenv import load_dotenv

import soundfile as sf
import whisper
from transformers import MarianMTModel, MarianTokenizer, AutoTokenizer, AutoModelForSeq2SeqLM
from elevenlabs import  ElevenLabs

from main import M2M_MODEL_ID

#certification fo macos SSL edge cases

os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()

load_dotenv("API.env")
Eleven_key = os.getenv("ELEVENLABS_API_KEY")
if not Eleven_key:
    raise RuntimeError("missing ELEVENLABS_API_KEY in API.env ")

tts_client = ElevenLabs(api_key=Eleven_key)
whisper_model = whisper.load_model("base")

M2M_MODEL_ID = "facebook/m2m100_418M"

def split_sentences(text: str) -> list[str]:
    parts = re.split(r'(?<=[.!?])\s+', text.strip())
    return [p for p in parts if p]

def marian_model_id(src: str, tgt: str) -> str:
    return f"Helsinki-NLP/opus-mt-{src}-{tgt}"

def marian_can_direct(src: str, tgt: str) -> bool:
    supported = {("en","fr"),("fr","en"),
                 ("en","es"),("es","en"),
                 ("en","vi"),("vi","en"),
                 ("en","zh"),("zh","en")}
    return (src, tgt) in supported

def marian_translate_chunk(chunk: str, src: str, tgt: str) -> str:
    mid = marian_model_id(src, tgt)
    tok = MarianTokenizer.from_pretrained(mid)
    mdl = MarianMTModel.from_pretrained(mid)
    inputs = tok([chunk], return_tensors="pt", padding=True, truncation=True)
    out = mdl.generate(**inputs, max_length=512)
    return tok.decode(out[0], skip_special_tokens=True)

def m2m_translate_chunk(chunk: str, src: str, tgt: str) -> str:
    tok = AutoTokenizer.from_pretrained(M2M_MODEL_ID)
    mdl = AutoModelForSeq2SeqLM.from_pretrained(M2M_MODEL_ID)
    tok.src_lang = src
    inputs = tok(chunk, return_tensors="pt")
    forced_bos = tok.get_lang_id(tgt)
    gen = mdl.generate(**inputs, forced_bos_token_id=forced_bos, max_length=512)
    return tok.batch_decode(gen, skip_special_tokens=True)[0]

def translate_text(text: str, src: str, tgt: str) -> str:
    if src == tgt:
        return text
    sentences = split_sentences(text)
    use_m2m = (src == "pa" or tgt == "pa")
    if not use_m2m and marian_can_direct(src, tgt):
        return " ".join(marian_translate_chunk(s, src, tgt) for s in sentences)
    if use_m2m:
        return " ".join(m2m_translate_chunk(s, src, tgt) for s in sentences)
    # pivot via English
    pivot = "en"
    if src != pivot:
        mid = " ".join(marian_translate_chunk(s, src, pivot) for s in sentences)
    else:
        mid = text
    final = []
    for s in split_sentences(mid):
        final.append(s if tgt == pivot else marian_translate_chunk(s, pivot, tgt))
    return " ".join(final)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

@app.get("/api/voices")
def list_voices():
    # ElevenLabs SDK doesn’t expose genders reliably; just return ids + names
    voices = tts_client.voices.get_all().voices
    return [{"id": v.voice_id, "name": v.name} for v in voices]

@app.post("/api/preview")
def preview_voice(text: str = Form("Hi, choose my voice."),
                  voice_id: str = Form(...)):
    audio = tts_client.text_to_speech.convert(
        text=text[:120],  # short preview
        voice_id=voice_id,
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )
    # audio is an iterator of chunks; buffer to bytes
    buf = b"".join(audio)
    return StreamingResponse(io.BytesIO(buf), media_type="audio/mpeg")

@app.post("/api/translate-tts")
async def translate_tts(
        file: UploadFile = File(...),
        src_lang: str = Form(...),   # e.g. "en", "fr", "es", "vi", "zh", "pa"
        tgt_lang: str = Form(...),
        voice_id: str = Form(...)
):
    # --- keep disk clean: use temp file that auto-deletes
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp:
        data = await file.read()
        # write as-is; front-end sends WAV/WEBM/OGG — if not WAV, bytes still okay for whisper
        tmp.write(data); tmp.flush()

        # If not WAV, decode to WAV for whisper with soundfile
        # (Many browsers send webm/ogg; whisper can take file path but expects audio; sf.read normalizes)
        audio, sr = sf.read(io.BytesIO(data), dtype="float32", always_2d=False)
        # write normalized WAV for whisper
        sf.write(tmp.name, audio, sr)

        result = whisper_model.transcribe(tmp.name)
        transcript = result.get("text", "").strip()

    translation = translate_text(transcript, src_lang, tgt_lang)

    audio_iter = tts_client.text_to_speech.convert(
        text=translation,
        voice_id=voice_id,
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )
    mp3 = b"".join(audio_iter)
    return StreamingResponse(io.BytesIO(mp3), media_type="audio/mpeg")