# BiomedConnect AI

BiomedConnect AI is now scaffolded as a lightweight full-stack project that keeps the fast feel of the original prototype while preparing it for real authentication, database-backed chat history, and server-side AI calls.

## Stack

- Frontend: Vite + HTML + CSS + JavaScript
- Backend: FastAPI
- Auth and database: Supabase Auth + Supabase Postgres
- AI proxy: FastAPI route that calls Groq server-side

The original standalone prototype remains in [`BiomedConnect_.html`](/c:/Users/katam/Downloads/bme%20connecting/BiomedConnect_.html) as a reference while the new app lives in `frontend/` and `backend/`.

## Project Layout

- `frontend/`: Vite app with the migrated interface
- `backend/`: FastAPI API for auth-aware chat and AI requests
- `supabase/schema.sql`: database tables and policies for profiles, chats, and messages

## Run The Frontend

1. `cd frontend`
2. `npm install`
3. Copy `.env.example` to `.env`
4. Fill in your Supabase URL and anon key
5. `npm run dev`

## Run The Backend

1. `cd backend`
2. `python -m venv .venv`
3. Activate the virtual environment
4. `pip install -r requirements.txt`
5. Copy `.env.example` to `.env`
6. Fill in your Supabase and Groq credentials
7. `uvicorn app.main:app --reload`

## Supabase Setup

1. Create a Supabase project
2. Run the SQL in `supabase/schema.sql`
3. Enable Email auth in Supabase Auth
4. Copy your project URL and anon key to `frontend/.env`
5. Copy your project URL, anon key, and service role key to `backend/.env`

## Notes

- The frontend uses optimistic UI updates so sending a message still feels instant.
- The backend is responsible for secure AI calls and database writes.
- Supabase Auth is used for sign-up, sign-in, and user identity.
- The current backend is ready for future streaming responses and RAG additions.

## Deploy To GitHub And Vercel

This project is easiest to deploy as one GitHub repository connected to two Vercel projects:

- Frontend project
  Root directory: `frontend`
- Backend project
  Root directory: `backend`

### Why two Vercel projects

- The frontend is a Vite static app
- The backend is a FastAPI app with secure server-side API keys
- Separating them keeps secrets off the frontend and avoids forcing a big rewrite

### Frontend Vercel environment variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL`
  Use your deployed backend URL, for example: `https://your-backend-project.vercel.app/api`

### Backend Vercel environment variables

- `APP_NAME=BiomedConnect API`
- `ENVIRONMENT=production`
- `FRONTEND_ORIGINS`
  Use your deployed frontend URL, for example: `https://your-frontend-project.vercel.app`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `GROQ_MODEL=llama-3.3-70b-versatile`
- `REQUEST_TIMEOUT_SECONDS=45`

### Supabase production updates

After deploying, add your real frontend Vercel URL in Supabase:

- `Authentication -> URL Configuration -> Site URL`
- `Authentication -> URL Configuration -> Redirect URLs`

Use your production frontend domain there so sign-in and sign-up keep working outside local development.
