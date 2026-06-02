import { createClient } from '@supabase/supabase-js'

function sanitizeCompanyName(name) {
  return String(name || 'company')
    .trim()
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .replace(/\s+/g, '_')
}

function getTabFolderName(tabKey) {
  const map = {
    energy: 'energy',
    renewable: 'renewable',
    ghg: 'ghg',
  }
  return map[String(tabKey || '').toLowerCase()] || String(tabKey || 'tab')
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

export async function upload(file, companyName, tabKey) {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY
  const bucket = process.env.SUPABASE_BUCKET

  if (!supabaseUrl || !supabaseKey || !bucket) {
    throw new Error('Supabase URL, Anon Key, or Bucket is not configured in .env.')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const storagePath = buildStoragePath(tabKey, companyName)
  const fileName = getStorageFileName(tabKey, companyName)

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file.buffer, {
      upsert: true,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath)

  return {
    provider: 'supabase-storage',
    fileName,
    storageFileName: fileName,
    storagePath,
    fileUrl: data.publicUrl,
  }
}

export default {
  upload,
}
