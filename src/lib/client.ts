export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  const data = await response.json()
  if (!response.ok) {
    if (response.status === 401 && url !== '/api/session')
      window.dispatchEvent(new Event('archive:unauthorized'))
    throw new ApiError(response.status, data.error ?? 'The request failed.')
  }
  return data as T
}

export function patch<T>(url: string, data: unknown) {
  return api<T>(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.'
}
