import AsyncStorage from "@react-native-async-storage/async-storage";

export const SERVICE_LOGOS_KEY = "@otp_service_logos_v1";

export interface ServiceLogos {
  [serviceId: string]: string; // URI or base64 data URI
}

export async function loadServiceLogos(): Promise<ServiceLogos> {
  try {
    const raw = await AsyncStorage.getItem(SERVICE_LOGOS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveServiceLogo(serviceId: string, uri: string): Promise<void> {
  const logos = await loadServiceLogos();
  logos[serviceId] = uri;
  await AsyncStorage.setItem(SERVICE_LOGOS_KEY, JSON.stringify(logos));
}

export async function removeServiceLogo(serviceId: string): Promise<void> {
  const logos = await loadServiceLogos();
  delete logos[serviceId];
  await AsyncStorage.setItem(SERVICE_LOGOS_KEY, JSON.stringify(logos));
}
