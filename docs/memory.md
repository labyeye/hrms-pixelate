# NestHR Project Memory

**Last reviewed:** 2026-09-20

## Verified Facts

- Root contains `backend`, `frontend`, `NestHR`, and `face-service`.
- Backend is Express/Mongoose with routes for workforce, attendance, payroll, leave, recruitment, performance, documents, billing, biometric, reports, and support.
- Web frontend is Vite React; mobile app is React Native.
- Face service is FastAPI and produces/verifies 128-dimension `face_recognition` embeddings.
- Backend route registration includes auth rate limits, API rate limits, uploads, internal stats, webhooks, and a health endpoint.
- Existing audit identifies critical biometric/ADMS authentication, document path traversal, and password-reset rate-limit risks.

## Operating Commands

```text
cd hrms/backend
npm run dev
npm run seed

cd hrms/frontend
npm run dev
npm run lint
npm run build

cd hrms/NestHR
npm start
npm run android
npm test

cd hrms/face-service
python -m venv venv
pip install --no-deps -r requirements.txt
uvicorn main:app --port 8091
```

## Integration Notes

- Backend, web, mobile, and face service must agree on API base URLs and shared auth/device secrets.
- The face service is intended to remain private behind the Node backend.
- WhatsApp templates, payroll documents, biometric devices, and payment providers are external contracts; update code and documentation together.
- Never copy `.env` values into docs, tickets, logs, or chat. Rotate exposed credentials.

## Documentation Habit

Record verified route changes, migration decisions, operational commands, and security decisions here. Keep this file factual and short; put roadmap work in `tasks.md`.
