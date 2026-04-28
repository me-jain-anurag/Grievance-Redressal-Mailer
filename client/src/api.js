const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  const text = await response.text()

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text)
    } catch {
      return { raw: text }
    }
  }

  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, options)
  const data = await readJsonResponse(response)

  if (!response.ok) {
    const message = data?.error || data?.detail || data?.raw || 'Request failed.'
    throw new Error(message)
  }

  return data
}
