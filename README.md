# Deepwoods ESG Data Collection Interface

Submission-ready ESG data collection portal with:

- Login page with assignment credentials
- ESG Data Bank home page
- Company details form
- Environment uploads for Energy, Renewable Energy, GHG Emissions
- Real storage integration with provider selection
- Google Sheets row logging for every submission
- Backend-protected upload and submit APIs

## Assignment Login

- Email: client@deepwoods.in
- Password: password123

These are configurable through APP_LOGIN_EMAIL and APP_LOGIN_PASSWORD.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Upload handling: Multer
- Storage: Supabase Storage, Google Drive, Cloudinary
- Logging: Google Sheets API

## Storage Strategy

Default provider is Supabase because it is the fastest to configure and verify.

Set STORAGE_PROVIDER in .env as one of:

- supabase
- google-drive
- cloudinary
- auto

When set to auto, backend tries: Supabase -> Google Drive -> Cloudinary.

## Environment Variables

Copy .env.example to .env and fill required values.

PowerShell:

Copy-Item .env.example .env

Required for all environments:

- PORT
- AUTH_TOKEN_SECRET
- APP_LOGIN_EMAIL
- APP_LOGIN_PASSWORD
- STORAGE_PROVIDER

Required when STORAGE_PROVIDER=supabase:

- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_BUCKET

Required when STORAGE_PROVIDER=google-drive:

- GOOGLE_SERVICE_ACCOUNT_JSON
- GOOGLE_DRIVE_FOLDER_ID

Required when STORAGE_PROVIDER=cloudinary:

- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

Required for submission logging to Google Sheets:

- GOOGLE_SERVICE_ACCOUNT_JSON
- GOOGLE_SHEET_ID

## Google Cloud Setup (Drive + Sheets)

1. Create a Google Cloud project.
2. Enable APIs:
- Google Drive API
- Google Sheets API
3. Create a Service Account.
4. Create and download Service Account JSON key.
5. Share target Drive folder with service account email as Editor.
6. Share target Google Sheet with service account email as Editor.
7. Put full JSON in GOOGLE_SERVICE_ACCOUNT_JSON in one line with escaped newlines in private_key.
8. Put folder ID in GOOGLE_DRIVE_FOLDER_ID.
9. Put spreadsheet ID in GOOGLE_SHEET_ID.

Service account permissions needed:

- Drive folder: Editor
- Google Sheet: Editor

## Supabase Setup (Recommended)

1. Create Supabase project.
2. Go to Storage and create bucket name, for example esg-uploads.
3. Set bucket access to Public.
4. Collect Project URL and anon public key.
5. Set in .env:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_BUCKET
6. Set STORAGE_PROVIDER=supabase.

Upload path format:

- company_name/energy-<timestamp>.xlsx
- company_name/renewable-<timestamp>.xlsx
- company_name/ghg-<timestamp>.xlsx

## Cloudinary Setup

1. Create Cloudinary account.
2. Collect cloud name, API key, API secret.
3. Set in .env:
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET
4. Set STORAGE_PROVIDER=cloudinary.

## Local Run

Install dependencies:

npm install

Start frontend dev server:

npm run dev

Start API server:

npm run server

Frontend URL:

http://localhost:5173

## Production Run

Build frontend:

npm run build

Start backend and serve built frontend:

npm start

## Submission Logging Columns

Google Sheet row values are appended in this order:

1. Company Name
2. No. of Employees
3. Industry
4. Energy Upload Link
5. Renewable Energy Upload Link
6. GHG Emissions Upload Link
7. Submitted At (IST)

## Deployment Notes

- Deploy as Node app.
- Ensure all required .env variables are set in hosting platform.
- Build command: npm run build
- Start command: npm start
