# NestHR Face Service

Internal microservice used by the backend to enroll and verify employee face
photos for mobile geofenced attendance. Produces 128-dimension `face_recognition`
(dlib) embeddings — the same format/threshold already used by the browser
biometric kiosk (`faceDescriptor` on the `Employee` model), so a face enrolled
via either flow works with both.

Not exposed publicly — only the Node backend talks to it.

## Setup

```bash
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
FACE_SERVICE_API_KEY=<shared-secret> uvicorn main:app --port 8091
```

## Backend configuration

Set on the Node backend (`backend/.env`):

```
FACE_SERVICE_URL=http://127.0.0.1:8091
FACE_SERVICE_API_KEY=<same-shared-secret>
```

## Endpoints

- `GET /health`
- `POST /enroll` — multipart `file` (single-face photo) → `{ encoding: number[128] }`
- `POST /verify` — multipart `file` + form field `encoding` (comma-separated floats) → `{ match: boolean, distance: number }`

Both mutating endpoints require an `x-api-key` header matching `FACE_SERVICE_API_KEY`
if that env var is set.
