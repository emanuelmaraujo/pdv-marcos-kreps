export type GeoCoordinates = { latitude: number; longitude: number };

/** Pede a localização atual do navegador. Rejeita com mensagem em pt-BR pronta para exibir. */
export function getCurrentPosition(): Promise<GeoCoordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Este navegador não suporta compartilhar localização."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("Permissão de localização negada. Você pode continuar sem marcar o ponto no mapa."));
        } else {
          reject(new Error("Não foi possível obter sua localização agora."));
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

/** Link universal do Google Maps — abre o app no celular ou o site no desktop. */
export function mapsUrlForCoordinates(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export function mapsUrlForAddress(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
