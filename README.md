# Aren Academy Website

## Current Backend Status
The UI is preserved, and the app now uses Supabase as the main data source.

Main files:
- `src/services/api.js`
- `src/lib/supabase/client.js`
- `src/lib/supabase/placeholders.js`
- `supabase/schema.sql`

The app uses placeholder data only as an emergency fallback when Supabase is not configured or a read query fails.

## Environment Variables
Create a local `.env` file from `.env.example` when you are ready to connect real services.

Required later:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `ADMIN_PASSWORD`

Do not put service-role keys or private keys in frontend code.

## Where the Logo Is Used
The main logo file is `public/logo.jpeg`.
The website and PWA icons are stored in `public`.

## Easy Upload Folder
If you want a simple folder that is ready to upload manually, run:

```bash
npm run build
npm run export:github
```

This creates a flat website folder at `_github-upload`.

## Local Development
```bash
npm install
npm run dev
```

## Production Build
```bash
npm run build
```

The production files will be created in the `dist` folder.
