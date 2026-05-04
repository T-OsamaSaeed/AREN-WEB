# Aren Academy Teacher PWA

Clean Next.js App Router rebuild for Aren Academy teachers.

## Overview

This project is a mobile-first teacher dashboard for:

- Dersler
- Aramalar
- Duyurular
- Admin weekly call reports

Backend data is Supabase only. There is no Google Apps Script, Google Sheets, Excel backend, Firebase, FCM, Vite, or static export workflow in the clean app.

## Tech Stack

- Next.js App Router
- Supabase
- Vercel
- PWA manifest

Push notifications are intentionally not included in this first phase.

## Supabase Setup

Run this SQL in Supabase:

```sql
-- See supabase/schema.sql
```

The schema creates:

- `teachers`
- `schedule_sessions`
- `call_assignments`
- `weekly_call_notes`
- `call_activity_log`
- `announcements`
- `push_subscriptions`

The first active teachers are:

- `GÖKHAN HOCA`
- `SAİKOU TEACHER`
- `AYŞEGÜL HOCA`
- `RABİA HOCA`

`ELİF HOCA` and `ZEYNA HOCA` are set inactive if they exist.

## Environment Variables

Create these in Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
```

Do not use `VITE_` variables. Do not expose `SUPABASE_SERVICE_ROLE_KEY` in client code.

## Importing Data

Import academy data directly into Supabase tables:

- Lessons go to `schedule_sessions`
- Parent-call assignments go to `call_assignments`
- Announcements go to `announcements`

Required matching field:

- `teacher_name` must exactly match one of the active teacher names.

## Deployment

Deploy the real source project from GitHub to Vercel.

Vercel settings:

- Framework preset: Next.js
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: leave default

Do not deploy `_github-upload`.
Do not deploy `dist`.
Do not deploy a prebuilt static export.

## Testing

1. Open `/`.
2. Enter an active teacher name, for example `GÖKHAN HOCA`.
3. Confirm `/dashboard` opens.
4. Open `Dersler` and confirm lessons load from `schedule_sessions`.
5. Open `Aramalar` and confirm students load from `call_assignments`.
6. Write a note and click `Kaydet`.
7. Confirm `weekly_call_notes` has a row for `teacher_name + student_name + week_key`.
8. Click the phone icon.
9. Confirm `call_activity_log` has `action_type = call`.
10. Click the WhatsApp icon.
11. Confirm `call_activity_log` has `action_type = whatsapp`.
12. Open `Duyurular` and confirm announcements load newest first.
13. Open `/admin`.
14. Enter `ADMIN_PASSWORD`.
15. Load the weekly report.
16. Create a test announcement and confirm it appears in `announcements`.

Important write behavior:

- `Not kaydedildi` appears only after Supabase returns saved data.
- `Arama kaydedildi` appears only after Supabase returns inserted call data.
- `WhatsApp kaydedildi` appears only after Supabase returns inserted WhatsApp data.
- Errors are shown on screen with the real Supabase message.
