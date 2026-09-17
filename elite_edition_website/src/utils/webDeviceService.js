/**
 * Elite Edition - Hardware & Web Device APIs Service
 * Handles Camera, Mic, GPS Geolocation, Physical Device APIs (Bluetooth, WebUSB, Serial),
 * Sensors, Service Workers, Push Notifications, WebAuthn Passkeys, Credential Management & SubtleCrypto.
 */

// ── 1. CAMERA & MICROPHONE PERMISSIONS ──
export async function requestCameraAndMicPermission(audioOnly = false) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Camera & Microphone APIs are not supported by this browser.');
  }
  const constraints = audioOnly ? { audio: true } : { video: { facingMode: 'environment' }, audio: true };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  return stream;
}

// ── 2. GPS GEOLOCATION PERMISSION & POSITION ──
export async function getCurrentGeoLocation() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      return reject(new Error('Geolocation is not supported by your browser.'));
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          timestamp: position.timestamp
        });
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

// ── 3. PHYSICAL DEVICE APIS (Bluetooth, WebUSB, Web Serial) ──
export async function requestBluetoothDevice() {
  if (!('bluetooth' in navigator)) {
    throw new Error('Web Bluetooth API is not supported on this device/browser.');
  }
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: ['battery_service', 'device_information']
  });
  return device;
}

export async function requestUsbDevice() {
  if (!('usb' in navigator)) {
    throw new Error('WebUSB API is not supported on this browser.');
  }
  const device = await navigator.usb.requestDevice({ filters: [] });
  return device;
}

export async function requestSerialPort() {
  if (!('serial' in navigator)) {
    throw new Error('Web Serial API is not supported on this browser.');
  }
  const port = await navigator.serial.requestPort();
  return port;
}

// ── 4. SENSORS (Device Motion & Orientation) ──
export async function requestMotionSensorPermission() {
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    const perm = await DeviceMotionEvent.requestPermission();
    if (perm !== 'granted') throw new Error('Motion Sensor permission denied.');
    return perm;
  }
  return 'granted';
}

// ── 5. SERVICE WORKER & CACHE STORAGE API ──
export async function registerServiceWorkerPwa() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('⚡ PWA Service Worker registered:', reg.scope);
      return reg;
    } catch (err) {
      console.warn('Service worker registration failed:', err);
    }
  }
  return null;
}

export async function preloadAppCacheStorage() {
  if ('caches' in window) {
    try {
      const cache = await caches.open('elite-static-cache-v1');
      await cache.addAll(['/', '/manifest.json', '/Logo.png', '/DigitalLogo.png']);
      console.log('⚡ Cache Storage API pre-loaded offline static assets.');
    } catch (e) {
      console.warn('Cache Storage API preload warning:', e);
    }
  }
}

// ── 6. WEBAUTHN / PASSKEYS & CREDENTIAL MANAGEMENT API ──
export async function registerPasskeyWebAuthn(userEmail, userName) {
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn Passkeys are not supported on this browser or device.');
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const userId = new Uint8Array(16);
  window.crypto.getRandomValues(userId);

  const publicKeyCredentialCreationOptions = {
    challenge,
    rp: { name: 'Elite Edition Enterprise', id: window.location.hostname },
    user: {
      id: userId,
      name: userEmail || 'user@eliteedition.in',
      displayName: userName || 'Elite Edition Staff'
    },
    pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'preferred' },
    timeout: 60000,
    attestation: 'direct'
  };

  const credential = await navigator.credentials.create({
    publicKey: publicKeyCredentialCreationOptions
  });

  return credential;
}

export async function authenticatePasskeyWebAuthn() {
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn Passkeys are not supported on this browser.');
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const publicKeyCredentialRequestOptions = {
    challenge,
    timeout: 60000,
    userVerification: 'preferred'
  };

  const assertion = await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions
  });

  return assertion;
}

// ── 7. SUBTLECRYPTO (SHA-256 & AES-GCM ENCRYPTION) ──
export async function hashStringSHA256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function encryptDataSubtle(plainText, secretPass) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(secretPass.padStart(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    enc.encode(plainText)
  );

  const encryptedArray = Array.from(new Uint8Array(encryptedBuffer));
  const ivArray = Array.from(iv);

  return JSON.stringify({
    iv: ivArray.map(b => b.toString(16).padStart(2, '0')).join(''),
    data: encryptedArray.map(b => b.toString(16).padStart(2, '0')).join('')
  });
}

// ── 8. GET ALL DEVICE PERMISSION STATES ──
export async function getAllWebDevicePermissions() {
  const result = {
    notifications: 'Notification' in window ? Notification.permission : 'unsupported',
    camera: 'unknown',
    microphone: 'unknown',
    geolocation: 'unknown',
    bluetooth: 'bluetooth' in navigator ? 'available' : 'unsupported',
    usb: 'usb' in navigator ? 'available' : 'unsupported',
    passkeys: typeof window !== 'undefined' && Boolean(window.PublicKeyCredential) ? 'available' : 'unsupported',
    serviceWorker: 'serviceWorker' in navigator ? 'available' : 'unsupported',
    cacheStorage: 'caches' in window ? 'available' : 'unsupported',
    subtleCrypto: typeof window !== 'undefined' && Boolean(window.crypto?.subtle) ? 'available' : 'unsupported'
  };

  if (navigator.permissions && navigator.permissions.query) {
    try {
      const cam = await navigator.permissions.query({ name: 'camera' }).catch(() => null);
      if (cam) result.camera = cam.state;

      const mic = await navigator.permissions.query({ name: 'microphone' }).catch(() => null);
      if (mic) result.microphone = mic.state;

      const geo = await navigator.permissions.query({ name: 'geolocation' }).catch(() => null);
      if (geo) result.geolocation = geo.state;
    } catch (e) {
      // Browser doesn't support query by name
    }
  }

  return result;
}
