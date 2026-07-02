import io
import os

import face_recognition
import numpy as np
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from PIL import Image

API_KEY = os.environ.get("FACE_SERVICE_API_KEY", "")
MATCH_THRESHOLD = float(os.environ.get("FACE_MATCH_THRESHOLD", "0.5"))

app = FastAPI(title="NestHR Face Service")


def check_api_key(x_api_key: str | None):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


def load_image(raw: bytes) -> np.ndarray:
    try:
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode image")
    return np.array(img)


def get_single_encoding(raw: bytes) -> list[float]:
    image = load_image(raw)
    locations = face_recognition.face_locations(image)
    if len(locations) == 0:
        raise HTTPException(status_code=422, detail="No face detected in image")
    if len(locations) > 1:
        raise HTTPException(
            status_code=422, detail="Multiple faces detected; use a single-face photo"
        )
    encodings = face_recognition.face_encodings(image, known_face_locations=locations)
    return encodings[0].tolist()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/enroll")
async def enroll(
    file: UploadFile = File(...),
    x_api_key: str | None = Header(default=None),
):
    check_api_key(x_api_key)
    raw = await file.read()
    encoding = get_single_encoding(raw)
    return {"success": True, "encoding": encoding}


@app.post("/verify")
async def verify(
    file: UploadFile = File(...),
    encoding: str = Form(...),
    x_api_key: str | None = Header(default=None),
):
    check_api_key(x_api_key)
    raw = await file.read()
    probe_encoding = np.array(get_single_encoding(raw))

    try:
        stored = np.array([float(v) for v in encoding.split(",")])
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid stored encoding")

    if stored.shape != probe_encoding.shape:
        raise HTTPException(status_code=400, detail="Encoding size mismatch")

    distance = float(np.linalg.norm(stored - probe_encoding))
    match = distance <= MATCH_THRESHOLD
    return {"success": True, "match": match, "distance": distance}
