import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPrivateOrDevHost,
  resolveApiBaseUrl,
  resolveImageUrlWithBase,
} from '../mobile/src/services/api-url';

test('Mobile URL: isPrivateOrDevHost correctly identifies private vs public hosts', () => {
  // Public production hosts
  assert.equal(isPrivateOrDevHost('https://godavari-one.vercel.app'), false);
  assert.equal(isPrivateOrDevHost('https://godavari-one.vercel.app/api/v1'), false);
  assert.equal(isPrivateOrDevHost('https://api.godavarione.org'), false);
  assert.equal(isPrivateOrDevHost('https://hbqlcypgfiwofpmonylv.supabase.co'), false);
  assert.equal(isPrivateOrDevHost('godavari-one.vercel.app'), false);

  // Local and private development hosts
  assert.equal(isPrivateOrDevHost('http://localhost:3000'), true);
  assert.equal(isPrivateOrDevHost('http://localhost:3000/api/v1'), true);
  assert.equal(isPrivateOrDevHost('http://127.0.0.1:3000'), true);
  assert.equal(isPrivateOrDevHost('http://10.0.2.2:3000'), true);
  assert.equal(isPrivateOrDevHost('http://192.168.1.100:3000'), true);
  assert.equal(isPrivateOrDevHost('http://192.168.137.1:3000'), true);
  assert.equal(isPrivateOrDevHost('http://10.0.0.5:3000'), true);
  assert.equal(isPrivateOrDevHost('http://172.20.10.2:3000'), true);
  assert.equal(isPrivateOrDevHost('http://my-macbook.local:3000'), true);

  // Edge cases and invalid inputs
  assert.equal(isPrivateOrDevHost(null), false);
  assert.equal(isPrivateOrDevHost(undefined), false);
  assert.equal(isPrivateOrDevHost(''), false);
});

test('Mobile URL: Requirement 1 & 2 - Production HTTPS and Vercel URL remain unchanged', () => {
  const vercelUrl = 'https://godavari-one.vercel.app/api/v1';

  // Even if devHost is active (e.g. Hotspot 192.168.137.1), the production URL MUST NOT be rewritten
  const resultAndroid = resolveApiBaseUrl({
    envUrl: vercelUrl,
    devHost: '192.168.137.1',
    platform: 'android'
  });
  assert.equal(resultAndroid, vercelUrl, 'Production HTTPS URL must remain unchanged on Android');

  const resultIos = resolveApiBaseUrl({
    envUrl: vercelUrl,
    devHost: '192.168.137.1',
    platform: 'ios'
  });
  assert.equal(resultIos, vercelUrl, 'Production HTTPS URL must remain unchanged on iOS');

  const resultWeb = resolveApiBaseUrl({
    envUrl: vercelUrl,
    devHost: '192.168.137.1',
    platform: 'web'
  });
  assert.equal(resultWeb, vercelUrl, 'Production HTTPS URL must remain unchanged on Web');
});

test('Mobile URL: Requirement 3 - Localhost is replaced with development LAN address when appropriate', () => {
  const localDevUrl = 'http://localhost:3000/api/v1';

  // When connecting from physical device over Wi-Fi, Metro devHost replaces localhost
  const result = resolveApiBaseUrl({
    envUrl: localDevUrl,
    devHost: '192.168.1.45',
    platform: 'android'
  });
  assert.equal(result, 'http://192.168.1.45:3000/api/v1', 'Localhost must be replaced with active LAN IP');
});

test('Mobile URL: Requirement 4 - Recognized private development IP behaves correctly', () => {
  const hardcodedLanUrl = 'http://192.168.1.99:3000/api/v1';

  // If mobile connects to a new hotspot/bundler IP, it adapts to the active devHost
  const result = resolveApiBaseUrl({
    envUrl: hardcodedLanUrl,
    devHost: '192.168.137.1',
    platform: 'android'
  });
  assert.equal(result, 'http://192.168.137.1:3000/api/v1', 'Stale LAN IP must be synchronized with active devHost');
});

test('Mobile URL: Requirement 5 - Invalid configuration is handled safely without throwing', () => {
  // Empty envUrl falls back to devHost:3000/api/v1 safely
  const resultEmpty = resolveApiBaseUrl({
    envUrl: '',
    devHost: '192.168.1.50',
    platform: 'ios'
  });
  assert.equal(resultEmpty, 'http://192.168.1.50:3000/api/v1');

  // Null envUrl falls back safely
  const resultNull = resolveApiBaseUrl({
    envUrl: null,
    devHost: '192.168.1.50',
    platform: 'ios'
  });
  assert.equal(resultNull, 'http://192.168.1.50:3000/api/v1');

  // Android emulator loopback fallback when devHost is localhost
  const resultEmulator = resolveApiBaseUrl({
    envUrl: null,
    devHost: 'localhost',
    platform: 'android'
  });
  assert.equal(resultEmulator, 'http://10.0.2.2:3000/api/v1');
});

test('Mobile URL: resolveImageUrlWithBase correctly resolves absolute and relative URLs', () => {
  const prodBase = 'https://godavari-one.vercel.app/api/v1';

  // Absolute URLs are preserved intact
  assert.equal(
    resolveImageUrlWithBase('https://images.unsplash.com/photo-12345', prodBase),
    'https://images.unsplash.com/photo-12345'
  );
  assert.equal(
    resolveImageUrlWithBase('http://example.com/image.png', prodBase),
    'http://example.com/image.png'
  );

  // Relative /uploads/ URLs are resolved against production domain
  assert.equal(
    resolveImageUrlWithBase('/uploads/1792246980513-4f6c0bc92e2cedaeea2b1290.png', prodBase),
    'https://godavari-one.vercel.app/uploads/1792246980513-4f6c0bc92e2cedaeea2b1290.png'
  );

  // Relative paths without leading slash
  assert.equal(
    resolveImageUrlWithBase('uploads/test.jpg', prodBase),
    'https://godavari-one.vercel.app/uploads/test.jpg'
  );

  // Null/empty/whitespace returns null
  assert.equal(resolveImageUrlWithBase(null, prodBase), null);
  assert.equal(resolveImageUrlWithBase(undefined, prodBase), null);
  assert.equal(resolveImageUrlWithBase('   ', prodBase), null);
});
