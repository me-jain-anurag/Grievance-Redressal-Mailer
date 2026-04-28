const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

export async function apiRequest(path, options = {}) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    const url = `${apiBaseUrl}${normalizedPath}`
    const response = await fetch(url, options)
    const raw = await response.text()
    let data

    try {
        data = JSON.parse(raw)
    } catch (err) {
        // Provide helpful diagnostic context when non-JSON is returned
        const snippet = raw ? raw.slice(0, 1000) : ''
        console.error('apiRequest: non-JSON response', { url, status: response.status, snippet })
        throw new Error(`API returned HTML/non-JSON (status ${response.status}). Check VITE_API_BASE_URL and /api routing. Response snippet: ${snippet}`)
    }

    if (!response.ok) {
        const message = data?.error || data?.detail || 'Request failed.'
        throw new Error(message)
    }

    return data
}
