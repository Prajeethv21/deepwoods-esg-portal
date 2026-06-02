import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import fsSync from 'fs'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
import { Readable } from 'stream'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { v2 as cloudinary } from 'cloudinary'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const app = express()

const LOGIN_EMAIL = String(
  process.env.APP_LOGIN_EMAIL || 'client@deepwoods.in',
).trim()
const LOGIN_PASSWORD = String(
  process.env.APP_LOGIN_PASSWORD || 'password123',
).trim()
const AUTH_TOKEN_SECRET = String(
  process.env.AUTH_TOKEN_SECRET || 'deepwoods-change-this-secret',
)
const STORAGE_PROVIDER = String(process.env.STORAGE_PROVIDER || 'supabase')
  .trim()
  .toLowerCase()
const AUTH_TOKEN_TTL_MS = 12 * 60 * 60 * 1000

app.use(cors())
app.use(express.json())

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
})

const TEMPLATE_FILES = {
  Energy: path.join(projectRoot, 'Energy.xlsx'),
  'Renewable Energy': path.join(projectRoot, 'Renewable Energy.xlsx'),
  'GHG emissions': path.join(projectRoot, 'GHG emissions.xlsx'),
}

const TAB_FOLDER_MAP = {
  energy: 'energy',
  renewable: 'renewable',
  ghg: 'ghg',
}

const TAB_UPLOAD_NAME_MAP = {
  energy: '_Energy_FY26.xlsx',
  renewable: '_Renewable_FY26.xlsx',
  ghg: '_GHG_FY26.xlsx',
}

function getTemplateFileForSheet(sheet) {
  return TEMPLATE_FILES[sheet] || TEMPLATE_FILES.Energy
}

function getTabFolderName(tabKey) {
  return TAB_FOLDER_MAP[String(tabKey || '').toLowerCase()] || String(tabKey || 'tab')
}

function getStorageFileName(tabKey, companyName) {
  const normalizedTabKey = String(tabKey || '').toLowerCase()
  const sanitizedCompany = sanitizeCompanyName(companyName)
  
  if (normalizedTabKey === 'energy') {
    return `${sanitizedCompany}_Energy_FY26.xlsx`
  } else if (normalizedTabKey === 'renewable') {
    return `${sanitizedCompany}_Renewable_Energy_FY26.xlsx`
  } else if (normalizedTabKey === 'ghg') {
    return `${sanitizedCompany}_GHG_Emissions_FY26.xlsx`
  }
  return `${sanitizedCompany}_upload.xlsx`
}

function buildStoragePath(tabKey, companyName) {
  const sanitizedCompany = sanitizeCompanyName(companyName)
  const folderName = getTabFolderName(tabKey)
  const fileName = getStorageFileName(tabKey, companyName)
  return `${sanitizedCompany}/${folderName}/${fileName}`
}

function sanitizeCompanyName(name) {
  return String(name || 'company')
    .trim()
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .replace(/\s+/g, '_')
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
  return Buffer.from(normalized + padding, 'base64').toString('utf-8')
}

function signPayload(payload) {
  return crypto
    .createHmac('sha256', AUTH_TOKEN_SECRET)
    .update(payload)
    .digest('hex')
}

function createAuthToken(email) {
  const expiresAt = Date.now() + AUTH_TOKEN_TTL_MS
  const payload = `${email}|${expiresAt}`
  const encodedPayload = base64UrlEncode(payload)
  const signature = signPayload(encodedPayload)

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt,
  }
}

function verifyAuthToken(token) {
  if (!token || !token.includes('.')) {
    return null
  }

  const [encodedPayload, providedSignature] = token.split('.')
  if (!encodedPayload || !providedSignature) {
    return null
  }

  const expectedSignature = signPayload(encodedPayload)
  if (providedSignature !== expectedSignature) {
    return null
  }

  const decoded = base64UrlDecode(encodedPayload)
  const [email, expiresAtRaw] = decoded.split('|')
  const expiresAt = Number(expiresAtRaw)

  if (!email || Number.isNaN(expiresAt) || Date.now() > expiresAt) {
    return null
  }

  return { email, expiresAt }
}

function requireAuth(req, res, next) {
  const authHeader = String(req.headers.authorization || '')
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing auth token.' })
    return
  }

  const token = authHeader.slice('Bearer '.length).trim()
  const auth = verifyAuthToken(token)

  if (!auth) {
    res.status(401).json({ error: 'Invalid or expired auth token.' })
    return
  }

  req.auth = auth
  next()
}

function getServiceAccountConfig() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function getIstTimestamp() {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
  })
}

async function getGoogleAuth(scopes) {
  const serviceAccount = getServiceAccountConfig()
  if (!serviceAccount) {
    return null
  }

  return new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes,
  })
}

async function ensureGoogleDriveFolder(drive, parentFolderId, folderName) {
  const cleanName = sanitizeCompanyName(folderName)
  const folderQuery = [
    `name='${cleanName}'`,
    "mimeType='application/vnd.google-apps.folder'",
    `'${parentFolderId}' in parents`,
    'trashed=false',
  ].join(' and ')

  const existing = await drive.files.list({
    q: folderQuery,
    fields: 'files(id, name)',
    pageSize: 1,
  })

  const existingFolder = existing.data.files?.[0]
  if (existingFolder?.id) {
    return existingFolder.id
  }

  const created = await drive.files.create({
    requestBody: {
      name: cleanName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id',
  })

  return created.data.id
}

async function uploadToGoogleDrive(file, companyName, tabKey) {
  const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID
  const auth = await getGoogleAuth(['https://www.googleapis.com/auth/drive'])

  if (!driveFolderId || !auth) {
    return null
  }

  const drive = google.drive({ version: 'v3', auth })
  const tabFolderId = await ensureGoogleDriveFolder(drive, driveFolderId, getTabFolderName(tabKey))

  const uploadName = getStorageFileName(tabKey, companyName)

  const created = await drive.files.create({
    requestBody: {
      name: uploadName,
      parents: [tabFolderId],
    },
    media: {
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: Readable.from(file.buffer),
    },
    fields: 'id, webViewLink, webContentLink',
  })

  const fileId = created.data.id

  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  })

  const meta = await drive.files.get({
    fileId,
    fields: 'webViewLink, webContentLink',
  })

  return {
    provider: 'google-drive',
    fileName: uploadName,
    storageFileName: uploadName,
    fileUrl: meta.data.webViewLink || meta.data.webContentLink,
  }
}

function hasGoogleDriveConfig() {
  return Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID && getServiceAccountConfig())
}

async function uploadToSupabase(file, companyName, tabKey) {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY
  const bucket = process.env.SUPABASE_BUCKET

  if (!supabaseUrl || !supabaseKey || !bucket) {
    return null
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const storagePath = buildStoragePath(tabKey, companyName)
  const bucketName = bucket
  const filePath = storagePath
  const fileName = getStorageFileName(tabKey, companyName)
  const uploadType = String(tabKey || '').toLowerCase()
  const uploadPath = filePath

  console.log("UPLOAD TYPE:", uploadType);
  console.log("COMPANY:", companyName);
  console.log("BUCKET:", bucketName);
  console.log("PATH:", uploadPath);
  console.log("FILE:", fileName);

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file.buffer, {
      upsert: true,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

  if (error) {
    console.error('StorageApiError:', error)
    throw new Error(`Supabase upload failed: ${error.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath)

  return {
    provider: 'supabase-storage',
    fileName: getStorageFileName(tabKey, companyName),
    storageFileName: getStorageFileName(tabKey, companyName),
    storagePath,
    fileUrl: data.publicUrl,
  }
}

function hasSupabaseConfig() {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_ANON_KEY &&
      process.env.SUPABASE_BUCKET,
  )
}

function uploadToCloudinary(file, companyName, tabKey) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    return null
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  })

  const folder = getTabFolderName(tabKey)
  const uploadName = getStorageFileName(tabKey, companyName)

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder,
        public_id: uploadName,
        overwrite: true,
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`))
          return
        }

        resolve({
          provider: 'cloudinary',
          fileName: uploadName,
          storageFileName: uploadName,
          fileUrl: result.secure_url,
        })
      },
    )

    stream.end(file.buffer)
  })
}

function hasCloudinaryConfig() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  )
}

async function appendToGoogleSheets(submission) {
  const sheetId = process.env.GOOGLE_SHEET_ID
  const auth = await getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets'])

  if (!sheetId || !auth) {
    return null
  }

  const companyName = submission.companyName
  const tabKey = submission.tabKey
  const publicUrl = submission.fileUrl

  const tabColumnMap = {
    energy: { col: 'E', idx: 4, name: 'Energy Upload Link' },
    renewable: { col: 'F', idx: 5, name: 'Renewable Energy Upload Link' },
    ghg: { col: 'G', idx: 6, name: 'GHG Emissions Upload Link' },
  }

  const colInfo = tabColumnMap[String(tabKey || '').toLowerCase()]
  if (!colInfo) {
    throw new Error(`Unsupported tabKey for Google Sheets mapping: ${tabKey}`)
  }

  const columnName = colInfo.name

  const sheets = google.sheets({ version: 'v4', auth })

  // 1. Get all current rows from columns A to H
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Sheet1!A:H',
  })
  const rows = response.data.values || []

  // 2. Search for the row matching companyName in Column B (index 1)
  let foundIndex = -1
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][1] && rows[i][1].toString().trim().toLowerCase() === companyName.trim().toLowerCase()) {
      foundIndex = i
      break
    }
  }

  if (foundIndex !== -1) {
    const rowNumber = foundIndex + 1
    console.log("COMPANY:", companyName);
    console.log("TAB:", tabKey);
    console.log("PUBLIC URL:", publicUrl);
    console.log("ROW FOUND:", rowNumber);
    console.log("COLUMN BEING UPDATED:", columnName);

    // Update the specific tab url cell
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `Sheet1!${colInfo.col}${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[publicUrl]],
      },
    })

    // Also update Submitted At in Column H
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `Sheet1!H${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[submission.submittedAt]],
      },
    })
  } else {
    const rowNumber = -1
    console.log("COMPANY:", companyName);
    console.log("TAB:", tabKey);
    console.log("PUBLIC URL:", publicUrl);
    console.log("ROW FOUND:", rowNumber);
    console.log("COLUMN BEING UPDATED:", columnName);

    // Row not found, append a new row starting from Column B
    const newRow = [
      companyName, // Column B
      submission.employees, // Column C
      submission.industry, // Column D
      tabKey === 'energy' ? publicUrl : '', // Column E
      tabKey === 'renewable' ? publicUrl : '', // Column F
      tabKey === 'ghg' ? publicUrl : '', // Column G
      submission.submittedAt, // Column H
    ]

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!B:H',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [newRow],
      },
    })
  }

  return true
}

function getUploadProviderOrder() {
  if (STORAGE_PROVIDER === 'auto') {
    return ['supabase', 'google-drive', 'cloudinary']
  }
  return [STORAGE_PROVIDER]
}

async function uploadWithConfiguredProvider(file, companyName, tabKey) {
  const providerOrder = getUploadProviderOrder()
  const providerErrors = []

  for (const provider of providerOrder) {
    try {
      if (provider === 'supabase') {
        if (!hasSupabaseConfig()) {
          providerErrors.push(
            'Supabase is selected but SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_BUCKET is missing.',
          )
          continue
        }

        const result = await uploadToSupabase(file, companyName, tabKey)
        if (result) {
          return result
        }
      }

      if (provider === 'google-drive') {
        if (!hasGoogleDriveConfig()) {
          providerErrors.push(
            'Google Drive is selected but GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_DRIVE_FOLDER_ID is missing.',
          )
          continue
        }

        const result = await uploadToGoogleDrive(file, companyName, tabKey)
        if (result) {
          return result
        }
      }

      if (provider === 'cloudinary') {
        if (!hasCloudinaryConfig()) {
          providerErrors.push(
            'Cloudinary is selected but CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET is missing.',
          )
          continue
        }

        const result = await uploadToCloudinary(file, companyName, tabKey)
        if (result) {
          return result
        }
      }

      if (!['supabase', 'google-drive', 'cloudinary'].includes(provider)) {
        providerErrors.push(
          `Unsupported STORAGE_PROVIDER value: ${provider}. Use supabase, google-drive, cloudinary, or auto.`,
        )
      }
    } catch (error) {
      providerErrors.push(`${provider}: ${error.message || 'Upload failed.'}`)
    }
  }

  throw new Error(providerErrors.join(' | '))
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase()
  const password = String(req.body?.password || '').trim()

  if (email !== LOGIN_EMAIL.toLowerCase() || password !== LOGIN_PASSWORD) {
    res.status(401).json({ error: 'Invalid credentials.' })
    return
  }

  const { token, expiresAt } = createAuthToken(LOGIN_EMAIL)
  res.json({ token, expiresAt })
})

app.get('/api/auth/validate', requireAuth, (req, res) => {
  res.json({ ok: true, email: req.auth.email, expiresAt: req.auth.expiresAt })
})

app.get('/api/template', (req, res) => {
  const sheet = String(req.query.sheet || 'Energy').replace(/[^a-zA-Z0-9 ]/g, '')
  const templateFile = getTemplateFileForSheet(sheet)

  if (!fsSync.existsSync(templateFile)) {
    res.status(404).json({ error: 'Template file not found in project root.' })
    return
  }

  const fileName = `${sheet.replace(/\s+/g, '_')}_Template.xlsx`

  res.download(templateFile, fileName)
})

app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { companyName, tabKey } = req.body
    const uploadType = String(tabKey || '').toLowerCase()

    if (!companyName || !tabKey) {
      res.status(400).json({ error: 'companyName and tabKey are required.' })
      return
    }

    console.log('UPLOAD TYPE:', uploadType)
    console.log('REQUEST BODY:', {
      companyName,
      tabKey,
      fileName: req.file?.originalname,
    })

    const file = req.file
    if (!file) {
      res.status(400).json({ error: 'No file uploaded.' })
      return
    }

    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      res.status(400).json({ error: 'Only .xlsx files are allowed.' })
      return
    }

    const uploadResult = await uploadWithConfiguredProvider(
      file,
      companyName,
      tabKey,
    )
    res.json(uploadResult)
  } catch (error) {
    res.status(500).json({ error: error.message || 'Upload failed.' })
  }
})

app.post('/api/submit', requireAuth, async (req, res) => {
  try {
    const { companyName, employees, industry, tabKey, fileName, fileUrl } =
      req.body

    if (!companyName || !employees || !industry || !tabKey || !fileName || !fileUrl) {
      res.status(400).json({
        error: 'Missing required fields for submission logging.',
      })
      return
    }

    const submission = {
      companyName,
      employees,
      industry,
      tabKey,
      fileName,
      fileUrl,
      submittedAt: getIstTimestamp(),
    }

    let warning = ''
    try {
      const loggedToSheets = await appendToGoogleSheets(submission)
      if (!loggedToSheets) {
        warning =
          'Google Sheets is not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SHEET_ID in .env.'
      }
    } catch (error) {
      warning = error.message || 'Google Sheets logging failed.'
      console.warn(warning)
    }

    res.json({
      message: 'Submission successful.',
      warning: warning || undefined,
    })
  } catch (error) {
    res.status(500).json({ error: error.message || 'Submit failed.' })
  }
})

const clientDist = path.join(projectRoot, 'dist')
if (fsSync.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.method !== 'GET') {
      next()
      return
    }

    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

const port = Number(process.env.PORT || 4000)
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`API server running on http://localhost:${port}`)
  })
}

export default app
