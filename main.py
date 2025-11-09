# voice_translate_tts.py
from fileinput import filename  # harmless; you don't need it but left as-is
import os
import re

from dotenv import load_dotenv
import sounddevice as sd
import soundfile as sf
import whisper

from transformers import MarianMTModel, MarianTokenizer, AutoTokenizer, AutoModelForSeq2SeqLM
from elevenlabs import ElevenLabs
from elevenlabs.play import play
import certifi

# -------- Env / SSL fixes (for mac cert issues) --------
os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()

# -------- Audio / Transcription settings --------
samplerate = 48000
channels = 1
filename = "recording.wav"
d_type = "int16"

# -------- Language menus --------
# We’ll support: English (en), French (fr), Spanish (es), Vietnamese (vi), Chinese (Mandarin) (zh), Punjabi (pa)
LANG_MENU = {
    "1": ("English", "en"),
    "2": ("Français", "fr"),
    "3": ("Español", "es"),
    "4": ("Tiếng Việt", "vi"),
    "5": ("中文（普通话）", "zh"),      # Using Mandarin as a fallback for Cantonese
    "6": ("ਪੰਜਾਬੀ", "pa"),
}

# Marian supports many en<->X pairs; we’ll use it when possible.
# For pairs not supported directly, we’ll pivot through English using Marian, except when Punjabi is involved,
# where we switch to M2M100 (multilingual).
M2M_MODEL_ID = "facebook/m2m100_418M"

def load_env_and_clients():
    load_dotenv("API.env")
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY missing. Put it in API.env or your environment.")
    tts_client = ElevenLabs(api_key=api_key)
    return tts_client

def choose_language(prompt: str) -> str:
    print(prompt)
    for k, (native_name, code) in LANG_MENU.items():
        print(f" {k}: {native_name}")
    choice = input(">> ").strip()
    while choice not in LANG_MENU:
        choice = input("Invalid option. Choose again: ").strip()
    return LANG_MENU[choice][1]  # returns the languag

def record_to_wav():
    with sf.SoundFile(filename, mode="w", samplerate=samplerate, channels=channels, subtype="PCM_16") as wav:
        print("Recording… press ENTER to stop.")
        with sd.InputStream(samplerate=samplerate, channels=channels, dtype=d_type,
                            callback=lambda indata, frames, time, status: wav.write(indata)):
            input()
    print(f"Saved to {filename}")

def transcribe_wav() -> str:
    model = whisper.load_model("base")
    result = model.transcribe(filename)
    text = result.get("text", "").strip()
    print("Transcribed:", text)
    return text

# ---- Sentence splitting to avoid truncation ----
def split_sentences(text: str) -> list[str]:
    parts = re.split(r'(?<=[.!?])\s+', text.strip())
    return [p for p in parts if p]

# ---- Marian translation helpers ----
def marian_model_id(src: str, tgt: str) -> str:
    # Marian naming pattern: opus-mt-<src>-<tgt>
    return f"Helsinki-NLP/opus-mt-{src}-{tgt}"

def marian_translate_chunk(chunk: str, src: str, tgt: str) -> str:
    model_id = marian_model_id(src, tgt)
    tokenizer = MarianTokenizer.from_pretrained(model_id)
    model = MarianMTModel.from_pretrained(model_id)
    inputs = tokenizer([chunk], return_tensors="pt", padding=True, truncation=True)
    out_tokens = model.generate(**inputs, max_length=512)
    return tokenizer.decode(out_tokens[0], skip_special_tokens=True)

def marian_can_direct(src: str, tgt: str) -> bool:
    # Marian has all of these common directions:
    supported = {("en","fr"),("fr","en"),
                 ("en","es"),("es","en"),
                 ("en","vi"),("vi","en"),
                 ("en","zh"),("zh","en")}
    return (src, tgt) in supported

# ---- M2M100 translation helpers (for Punjabi or fallbacks) ----
def m2m_translate_chunk(chunk: str, src: str, tgt: str) -> str:
    tokenizer = AutoTokenizer.from_pretrained(M2M_MODEL_ID)
    model = AutoModelForSeq2SeqLM.from_pretrained(M2M_MODEL_ID)

    # Map to M2M language tags (these are standard ISO codes; 'pa' works for Punjabi)
    tokenizer.src_lang = src
    inputs = tokenizer(chunk, return_tensors="pt")
    forced_bos_token_id = tokenizer.get_lang_id(tgt)
    generated_tokens = model.generate(**inputs, forced_bos_token_id=forced_bos_token_id, max_length=512)
    return tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)[0]

def translate_text(text: str, src: str, tgt: str) -> str:
    if src == tgt:
        return text

    sentences = split_sentences(text)
    outputs = []

    # If Punjabi is involved OR Marian cannot translate directly, use strategy:
    # 1) If Punjabi involved -> use M2M100 directly
    # 2) Else if Marian direct pair -> Marian
    # 3) Else pivot through English via Marian: src->en then en->tgt
    use_m2m = (src == "pa" or tgt == "pa")

    if not use_m2m and marian_can_direct(src, tgt):
        for s in sentences:
            outputs.append(marian_translate_chunk(s, src, tgt))
        return " ".join(outputs)

    if use_m2m:
        for s in sentences:
            outputs.append(m2m_translate_chunk(s, src, tgt))
        return " ".join(outputs)

    # pivot via English with Marian for non-Punjabi pairs that lack a direct Marian model
    pivot = "en"
    # src -> en
    mid_parts = []
    if src != pivot:
        for s in sentences:
            mid_parts.append(marian_translate_chunk(s, src, pivot))
        mid_text = " ".join(mid_parts)
    else:
        mid_text = text

    # en -> tgt
    final_parts = []
    for s in split_sentences(mid_text):
        if tgt == pivot:
            final_parts.append(s)
        else:
            final_parts.append(marian_translate_chunk(s, pivot, tgt))
    return " ".join(final_parts)

# ---- TTS ----
def speak_with_elevenlabs(client: ElevenLabs, text: str):
    audio = client.text_to_speech.convert(
        text=text,
        voice_id="JBFqnCBsd6RMkjVDRZzb",           # pick any voice you like
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )
    play(audio)

def main():
    tts_client = load_env_and_clients()

    # 1) Record and transcribe
    record_to_wav()
    transcript = transcribe_wav()
    if not transcript:
        print("No speech detected.")
        return

    # Confirm transcript
    yn = input("Is the transcript correct?\n 1: yes\n 2: no\n>> ").strip()
    while yn not in ("1", "2"):
        yn = input("Please enter 1 or 2: ").strip()
    if yn == "2":
        print("Re-recording…")
        return main()

    # 2) Ask for source + target languages
    src = choose_language("What language are you speaking?")
    tgt = choose_language("What language do you want to translate to?")

    # 3) Translate
    translation = translate_text(transcript, src, tgt)
    print("Translation:", translation)

    # 4) TTS
    speak_with_elevenlabs(tts_client, translation)

    # 5) Optional: Play back the original mic capture
    data, sr = sf.read(filename, dtype=d_type)
    sd.play(data, sr); sd.wait()

if __name__ == "__main__":
    main()
