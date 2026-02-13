import { GeolocationData } from '../types';

/**
 * Resolves coarse geolocation from an IP address.
 */
export async function getGeolocationFromIP(ip: string): Promise<GeolocationData | null> {
  try {
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,city,timezone,isp`
    );
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
  } catch (error) {
    console.error('Error getting geolocation:', error);
  }

  return null;
}
