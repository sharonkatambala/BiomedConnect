# BiomedConnect

Biomedical-engineering–focused AI chat (Vite + vanilla JS frontend, FastAPI + Supabase + Groq backend).

## Production deployment checklist

This repository is already structured so you can:

- deploy the **frontend** on **Vercel** from the `frontend` folder
- deploy the **backend API** on **Render** using the included root `render.yaml`
- connect both with environment variables so the live app is usable by anyone

---

## 1) Push to the existing GitHub repo

This repo already points at:

`https://github.com/sharonkatambala/BiomedConnect.git`

After reviewing your changes locally, push normally:

```bash
git add .
git commit -m "Prepare BiomedConnect for production deployment"
git push origin main
```

---

## 2) Deploy the frontend on Vercel

1. In [Vercel](https://vercel.com), import or open the existing GitHub-connected project.
2. In **Project Settings → General → Root Directory**, set **`frontend`**.
3. In **Project Settings → General → Node.js Version**, choose **20.x**.
4. Ensure Vercel uses the existing `frontend/vercel.json`:
   - install command: `npm install`
   - build command: `npm run build`
   - output directory: `dist`

### Frontend environment variables in Vercel

Set these in **Project → Settings → Environment Variables** for **Production** and **Preview**:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `VITE_API_BASE_URL` | Full backend API base URL including `/api`, e.g. `https://biomedconnect-api.onrender.com/api` |

Redeploy after changing env vars.

### If production still shows an older UI

Vercel keeps serving the **last successful deployment**. If the latest deploy failed:

1. Open **Deployments**
2. Open the latest failed deployment
3. Review **Build Logs**
4. Fix the issue
5. Redeploy once with build cache disabled

---

## 3) Deploy the backend API on Render

This repo now includes a root **`render.yaml`** so Render can create the API service from GitHub.

### Recommended Render setup

1. Go to [Render](https://render.com)
2. Create a **New Blueprint Instance** from this GitHub repository
3. Render will detect `render.yaml`
4. Confirm the generated web service that uses:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path:** `/api/health`

### Backend environment variables in Render

Set these values in Render:

| Name | Value |
|------|-------|
| `ENVIRONMENT` | `production` |
| `FRONTEND_ORIGINS` | Your Vercel URL(s), comma-separated for custom domains if needed |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `GROQ_API_KEY` | Your Groq API key |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |
| `GROQ_CLASSIFIER_MODEL` | `llama-3.1-8b-instant` |

### Backend CORS

- Preview URLs `https://*.vercel.app` are already allowed via `allow_origin_regex` in `backend/app/main.py`
- For your production Vercel URL or a custom domain, add it to `FRONTEND_ORIGINS`
- Multiple origins should be comma-separated

### Backend health check

After deployment, verify:

`https://your-render-service.onrender.com/api/health`

You should get a JSON response showing `status: ok`.

---

## 4) Configure Supabase for production auth

In **Supabase → Authentication → URL Configuration**:

- set **Site URL** to your production Vercel URL
- add your production Vercel URL to **Redirect URLs**
- add `http://localhost:5173` for local development

Without this, sign-in may fail in production.

---

## 5) If your Supabase project already existed before this push

Apply the SQL in:

- `backend/migrations/add_starred_column.sql`
- `backend/migrations/create_community_posts.sql`

Or rerun the full `supabase/schema.sql` in a fresh project so chat starring and community posts work correctly in production.

---

## 6) Go live flow

Once both deployments exist:

1. Copy your live Render API URL
2. Set `VITE_API_BASE_URL` in Vercel to that URL **including `/api`**
3. Redeploy Vercel
4. Test:
   - loading the app
   - sign up / sign in
   - starting a new chat
   - loading recents
   - community chat access

---

## Local development

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Frontend proxies `/api` to `http://127.0.0.1:8000` during `npm run dev`. See `frontend/.env.example` and `backend/.env.example`.

## Mobile

The UI uses responsive layout, safe-area insets for notched phones, larger tap targets (send, menu), and `100dvh` for stable viewport height.
