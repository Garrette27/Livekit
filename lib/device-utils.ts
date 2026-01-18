import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { DeviceFingerprint, GeolocationData } from './types';

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

export async function getGeolocationFromIP(ip: string): Promise<GeolocationData | null> {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,city,timezone,isp`);
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        ip,
        country: data.country,
        countryCode: data.countryCode,
        region: data.region,
        city: data.city,
        timezone: data.timezone,
        isp: data.isp,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geolocation error:', error);
    return null;
  }
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

export function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

export function detectBrowser(userAgent: string): string {
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  return 'Unknown';
}