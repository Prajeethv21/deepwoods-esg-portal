import { google } from 'googleapis'
import { Readable } from 'stream'

function sanitizeCompanyName(name) {
  return String(name || 'company')
    .trim()
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .replace(/\s+/g, '_')
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

function getServiceAccountConfig() {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    return null
  }

  raw = raw.trim()
  if (raw.startsWith('GOOGLE_SERVICE_ACCOUNT_JSON=')) {
    raw = raw.substring('GOOGLE_SERVICE_ACCOUNT_JSON='.length).trim()
  }

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
    }
    return parsed
  } catch (err) {
    console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON in Google Drive Storage:', err.message)
    return null
  }
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

async function ensureFolder(drive, parentId, folderName) {
  const cleanName = folderName.trim().replace(/[\\/:*?"<>|]/g, '')
  const query = [
    `name='${cleanName.replace(/'/g, "\\'")}'`,
    "mimeType='application/vnd.google-apps.folder'",
    `'${parentId}' in parents`,
    'trashed=false',
  ].join(' and ')

  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    pageSize: 1,
  })

  const existingFolder = response.data.files?.[0]
  if (existingFolder?.id) {
    return existingFolder.id
  }

  const created = await drive.files.create({
    requestBody: {
      name: cleanName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  })

  // Attempt to set public reader permission so anything inside is accessible
  try {
    await drive.permissions.create({
      fileId: created.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    })
  } catch (err) {
    console.warn(`Could not set public permissions on folder "${cleanName}":`, err.message)
  }

  return created.data.id
}

export async function upload(file, companyName, tabKey) {
  const auth = await getGoogleAuth(['https://www.googleapis.com/auth/drive'])
  if (!auth) {
    throw new Error('Google Drive API authorization failed. Check GOOGLE_SERVICE_ACCOUNT_JSON in your configuration.')
  }

  const drive = google.drive({ version: 'v3', auth })
  const baseParentId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'root'

  // 1. Get or create root "ESG Uploads" folder under base parent folder
  const esgUploadsFolderId = await ensureFolder(drive, baseParentId, 'ESG Uploads')

  // 2. Get or create company folder under "ESG Uploads"
  const companyFolderId = await ensureFolder(drive, esgUploadsFolderId, companyName)

  // 3. Upload the file to the company folder
  const uploadName = getStorageFileName(tabKey, companyName)
  const created = await drive.files.create({
    requestBody: {
      name: uploadName,
      parents: [companyFolderId],
    },
    media: {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: Readable.from(file.buffer),
    },
    fields: 'id, webViewLink, webContentLink',
  })

  const fileId = created.data.id

  // 4. Grant read permissions to anyone
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    })
  } catch (err) {
    console.warn(`Could not set public permissions on uploaded file "${uploadName}":`, err.message)
  }

  // 5. Fetch shareable link
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

export default {
  upload,
}
