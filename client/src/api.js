const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

export async function apiRequest(path, options = {}) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    const response = await fetch(`${apiBaseUrl}${normalizedPath}`, options)
    const raw = await response.text()
    let data

    try {
        data = JSON.parse(raw)
    } catch {
        throw new Error('API returned HTML/non-JSON. Check VITE_API_BASE_URL and /api routing.')
    }

    if (!response.ok) {
        const message = data?.error || data?.detail || 'Request failed.'
        throw new Error(message)
    }

    return data
}
