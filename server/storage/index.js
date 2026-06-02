import supabaseStorage from './supabaseStorage.js'
import googleDriveStorage from './googleDriveStorage.js'

function getActiveProvider() {
  const provider = String(process.env.STORAGE_PROVIDER || 'google-drive')
    .trim()
    .toLowerCase()

  return provider === 'supabase' ? 'supabase' : 'google-drive'
}

export async function upload(file, companyName, tabKey) {
  const active = getActiveProvider()
  const errors = []

  if (active === 'google-drive') {
    try {
      console.log('Attempting upload using active provider: google-drive')
      return await googleDriveStorage.upload(file, companyName, tabKey)
    } catch (err) {
      console.warn('Google Drive upload failed, falling back to Supabase:', err.message)
      errors.push(`Google Drive: ${err.message}`)
    }
  }

  // Fallback or explicit Supabase
  try {
    console.log('Attempting upload using fallback/explicit provider: supabase')
    return await supabaseStorage.upload(file, companyName, tabKey)
  } catch (err) {
    errors.push(`Supabase: ${err.message}`)
    throw new Error(`Upload failed. Providers tried: [${active === 'google-drive' ? 'google-drive, ' : ''}supabase]. Errors: ${errors.join(' | ')}`)
  }
}

export default {
  upload,
}
