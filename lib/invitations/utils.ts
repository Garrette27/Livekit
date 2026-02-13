import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { DeviceFingerprint } from '../types';

export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  return (request as any).ip || 'unknown';
}

export function detectBrowser(userAgent: string): string {
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  return 'Unknown';
}

export function generateDeviceFingerprintHash(deviceData: DeviceFingerprint): string {
  const fingerprintString = [
    deviceData.userAgent,
    deviceData.language,
    deviceData.platform,
    deviceData.screenResolution,
    deviceData.timezone,
    deviceData.cookieEnabled.toString(),
    deviceData.doNotTrack,
  ].join('|');

  return crypto.createHash('sha256').update(fingerprintString).digest('hex');
}

export function toDate(value: any, fallback = new Date()): Date {
  if (!value) {
    return fallback;
  }

  if (typeof value.toDate === 'function') {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export function getInviteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
}

export function buildInviteUrl(token: string): string {
  return `${getInviteBaseUrl()}/invite/${token}`;
}
