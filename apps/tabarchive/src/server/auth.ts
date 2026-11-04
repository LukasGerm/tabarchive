import {
  createHmac,
  randomBytes,
  timingSafeEqual,
  createHash,
} from 'node:crypto'
import { HttpError } from './http'

const cookieName = 'tabarchive_session'
const lifetime = 60 * 60 * 24 * 7
const attempts: number[] = []

function configuration() {
  const password = process.env.ARCHIVE_PASSWORD ?? ''
  const secret = process.env.SESSION_SECRET ?? ''
  if (password.length < 16 || secret.length < 32)
    throw new HttpError(
      503,
      'The archive owner needs to configure a password and session secret before signing in.',
    )
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.APP_ORIGIN?.startsWith('https://')
  ) {
    throw new HttpError(
      503,
      'The archive owner needs to configure its HTTPS address.',
    )
  }
  return { password, secret }
}

function safeEqual(a: string, b: string) {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  )
}

function sign(value: string) {
  const { password, secret } = configuration()
  // Rotating either credential revokes all sessions.
  return createHmac('sha256', secret)
    .update(password)
    .update('\0')
    .update(value)
    .digest('base64url')
}

export function requireSameOrigin(request: Request) {
  const expected = process.env.APP_ORIGIN ?? new URL(request.url).origin
  if (request.headers.get('origin') !== expected)
    throw new HttpError(403, 'This request did not come from your archive.')
}

export function isAuthenticated(request: Request) {
  configuration()
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1)
  if (!token || token.length > 300) return false
  const [expires, nonce, signature, extra] = token.split('.')
  if (!expires || !nonce || !signature || extra || !/^\d+$/.test(expires))
    return false
  const expiry = Number(expires)
  const now = Math.floor(Date.now() / 1000)
  if (expiry <= now || expiry > now + lifetime) return false
  return safeEqual(signature, sign(`${expires}.${nonce}`))
}

export function requireOwner(request: Request) {
  if (!isAuthenticated(request))
    throw new HttpError(401, 'Sign in to open your archive.')
  if (!['GET', 'HEAD'].includes(request.method)) requireSameOrigin(request)
}

function cookie(value: string, maxAge: number) {
  const secure =
    process.env.NODE_ENV === 'production' ||
    process.env.APP_ORIGIN?.startsWith('https://')
  return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
}

export function login(request: Request, password: unknown) {
  requireSameOrigin(request)
  const config = configuration()
  const now = Date.now()
  // Global single-owner throttling avoids trusting spoofable proxy/IP headers.
  while (attempts.length && attempts[0] < now - 15 * 60 * 1000) attempts.shift()
  if (attempts.length >= 10)
    throw new HttpError(
      429,
      'Too many sign-in attempts. Try again in 15 minutes.',
    )
  attempts.push(now)
  if (typeof password !== 'string' || !safeEqual(password, config.password))
    throw new HttpError(401, 'That password wasn’t right. Try again.')
  attempts.length = 0
  const value = `${Math.floor(now / 1000) + lifetime}.${randomBytes(24).toString('base64url')}`
  return cookie(`${value}.${sign(value)}`, lifetime)
}

export function logout(request: Request) {
  requireSameOrigin(request)
  return cookie('', 0)
}
