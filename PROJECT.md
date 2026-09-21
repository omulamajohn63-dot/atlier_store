# Modeza Boutique

A full-stack fashion e-commerce application.

## Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Django, Django REST Framework, PostgreSQL
- **Authentication:** Supabase Auth
- **Image storage:** Supabase Storage
- **Deployment:** Vercel frontend, Render backend

## Structure

- `frontend/` - Customer storefront
- `backend/` - Django API and admin dashboard
- `supabase/` - Database setup and migrations
- `render.yaml` - Render deployment configuration

## Local Development

```bash
# Backend
cd backend
python manage.py migrate
python manage.py runserver

# Frontend, in another terminal
cd frontend
npm install
npm run dev
```

The frontend uses `VITE_API_BASE_URL` to reach the backend and `VITE_SUPABASE_URL` plus `VITE_SUPABASE_ANON_KEY` for customer authentication.

## Production

- Deploy `backend/` to Render.
- Deploy `frontend/` to Vercel.
- Configure Supabase Auth redirect URLs for the Vercel domain.
- Configure Render with Supabase JWT and storage credentials.
- Keep service-role keys server-side only.

## Validation

```bash
cd backend
python manage.py check
python manage.py test

cd ../frontend
npm run lint
npm run build
```
