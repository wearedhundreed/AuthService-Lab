import { BiometricType, WirePayloadSnapshot } from '../types/auth';

export interface MockPasskeyRegistrationOptions {
  rpId?: string;
  rpName?: string;
  origin?: string;
  username?: string;
  displayName?: string;
  teamId?: string;
  bundleId?: string;
  biometricType?: BiometricType;
  challengeOverride?: string;
  crossOrigin?: boolean;
}

export interface MockPasskeyRegistrationPayload {
  generatedAt: string;
  requestToAuthenticationServices: {
    providerClass: 'ASAuthorizationPlatformPublicKeyCredentialProvider';
    relyingPartyIdentifier: string;
    rpName: string;
    associatedDomainEntitlement: string;
    appID: string;
    name: string;
    displayName: string;
    userIDBase64Url: string;
    challengeBase64Url: string;
    userVerificationPreference: 'required';
    attestationPreference: 'none';
    pubKeyCredParams: Array<{ type: 'public-key'; alg: number; label: string }>;
  };
  clientDataJSON: {
    type: 'webauthn.create';
    challenge: string;
    origin: string;
    crossOrigin: boolean;
  };
  rawClientDataJSONBase64Url: string;
  authenticatorData: {
    rpIdHashBase64Url: string;
    flagsByteHex: string;
    flags: {
      UP: boolean;
      UV: boolean;
      BE: boolean;
      BS: boolean;
      AT: boolean;
      ED: boolean;
    };
    signCount: number;
    aaguid: string;
    credentialIDBase64Url: string;
    cosePublicKey: {
      kty: 2;
      alg: -7;
      crv: 1;
      xBase64Url: string;
      yBase64Url: string;
    };
  };
  receivedByAuthenticationServices: {
    swiftClass: 'ASAuthorizationPlatformPublicKeyCredentialRegistration';
    swiftDelegateMethod: 'authorizationController(controller:didCompleteWithAuthorization:)';
    attachment: 'platform';
    biometryUsed: BiometricType;
    credentialID: string;
    rawClientDataJSON: string;
    rawAttestationObject: string;
    attestationFormat: 'none';
  };
  swiftInspectionSnippet: string;
  wireSnapshot: WirePayloadSnapshot;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function stringToBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  return bytesToBase64Url(bytes);
}

function randomBase64Url(byteLength: number): string {
  const buf = new Uint8Array(byteLength);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < byteLength; i++) {
      buf[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToBase64Url(buf);
}

/**
 * Computes a deterministic 32-byte digest representation for hypothetical rpIdHash visualization
 * when synchronous execution is needed.
 */
function deterministicRpHashBase64Url(rpId: string): string {
  const out = new Uint8Array(32);
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < rpId.length; i++) {
    const c = rpId.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b);
  }
  for (let i = 0; i < 32; i++) {
    h1 = Math.imul(h1 ^ (i + 17), 0x01000193);
    h2 = Math.imul(h2 ^ (h1 >>> 16), 0xc2b2ae35);
    out[i] = ((h1 ^ h2) >>> ((i % 4) * 8)) & 0xff;
  }
  return bytesToBase64Url(out);
}

/**
 * Generates a complete mock Passkey (WebAuthn ES256) registration payload
 * illustrating both the challenge/origin request options sent to iOS
 * ASAuthorizationPlatformPublicKeyCredentialProvider and the resulting
 * ASAuthorizationPlatformPublicKeyCredentialRegistration received by the app.
 */
export function generateMockPasskeyRegistrationPayload(
  options: MockPasskeyRegistrationOptions = {}
): MockPasskeyRegistrationPayload {
  const rpId = (options.rpId || 'securepasswordmanager.net')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0] || 'securepasswordmanager.net';
  const rpName = (options.rpName || 'AuthServices Lab iOS RP').trim();
  const origin = (options.origin || `https://${rpId}`).trim();
  const username = (options.username || 'maya.lin@icloud.com').trim();
  const displayName = (options.displayName || 'Maya Lin').trim();
  const teamId = (options.teamId || 'A1B2C3D4E5').trim().toUpperCase();
  const bundleId = (options.bundleId || 'com.authserviceslab.ios').trim();
  const biometricType: BiometricType = options.biometricType || 'faceId';
  const crossOrigin = Boolean(options.crossOrigin);

  const challenge = options.challengeOverride?.trim() || randomBase64Url(32);
  const userID = randomBase64Url(16);
  const credentialID = randomBase64Url(32);
  const rpIdHash = deterministicRpHashBase64Url(rpId);
  const xCoord = randomBase64Url(32);
  const yCoord = randomBase64Url(32);

  const clientDataJSON = {
    type: 'webauthn.create' as const,
    challenge,
    origin,
    crossOrigin,
  };
  const rawClientDataJSONBase64Url = stringToBase64Url(JSON.stringify(clientDataJSON));

  // Simulated CBOR attestationObject wrapper encoded in base64url for visual inspection
  const mockAttestationSummary = JSON.stringify({
    fmt: 'none',
    attStmt: {},
    authData: {
      rpIdHash,
      flags: '0x5d',
      signCount: 0,
      aaguid: 'fbfc3007-154e-4ecc-8c0b-6e02055707bd',
      credentialID,
    },
  });
  const rawAttestationObject = stringToBase64Url(mockAttestationSummary);
  const generatedAt = new Date().toISOString();

  const swiftInspectionSnippet = `func authorizationController(
  controller: ASAuthorizationController,
  didCompleteWithAuthorization authorization: ASAuthorization
) {
  guard let registration = authorization.credential
    as? ASAuthorizationPlatformPublicKeyCredentialRegistration else { return }

  let credentialID = registration.credentialID.base64EncodedString()
  let clientData = try? JSONDecoder().decode(
    ClientDataPayload.self,
    from: registration.rawClientDataJSON
  )
  // Expected origin: "${origin}"
  // Expected challenge: "${challenge}"
  let attestationObject = registration.rawAttestationObject
}`;

  const rawPayload: Record<string, unknown> = {
    framework: 'AuthenticationServices',
    relyingParty: { rpId, rpName, origin, associatedDomain: `webcredentials:${rpId}` },
    challenge,
    clientDataJSON,
    rawClientDataJSONBase64Url,
    authenticatorData: {
      rpIdHashBase64Url: rpIdHash,
      flagsByteHex: '0x5d',
      flags: { UP: true, UV: true, BE: true, BS: true, AT: true, ED: false },
      signCount: 0,
      aaguid: 'fbfc3007-154e-4ecc-8c0b-6e02055707bd',
      credentialID,
      coseKeyES256: { kty: 2, alg: -7, crv: 1, x: xCoord, y: yCoord },
    },
    asAuthorizationRegistration: {
      credentialID,
      rawClientDataJSON: rawClientDataJSONBase64Url,
      rawAttestationObject,
      attachment: 'platform',
    },
  };

  return {
    generatedAt,
    requestToAuthenticationServices: {
      providerClass: 'ASAuthorizationPlatformPublicKeyCredentialProvider',
      relyingPartyIdentifier: rpId,
      rpName,
      associatedDomainEntitlement: `webcredentials:${rpId}`,
      appID: `${teamId}.${bundleId}`,
      name: username,
      displayName,
      userIDBase64Url: userID,
      challengeBase64Url: challenge,
      userVerificationPreference: 'required',
      attestationPreference: 'none',
      pubKeyCredParams: [
        { type: 'public-key', alg: -7, label: 'ES256 (Secure Enclave P-256)' },
        { type: 'public-key', alg: -257, label: 'RS256 (Fallback)' },
      ],
    },
    clientDataJSON,
    rawClientDataJSONBase64Url,
    authenticatorData: {
      rpIdHashBase64Url: rpIdHash,
      flagsByteHex: '0x5d',
      flags: {
        UP: true,
        UV: true,
        BE: true,
        BS: true,
        AT: true,
        ED: false,
      },
      signCount: 0,
      aaguid: 'fbfc3007-154e-4ecc-8c0b-6e02055707bd',
      credentialIDBase64Url: credentialID,
      cosePublicKey: {
        kty: 2,
        alg: -7,
        crv: 1,
        xBase64Url: xCoord,
        yBase64Url: yCoord,
      },
    },
    receivedByAuthenticationServices: {
      swiftClass: 'ASAuthorizationPlatformPublicKeyCredentialRegistration',
      swiftDelegateMethod: 'authorizationController(controller:didCompleteWithAuthorization:)',
      attachment: 'platform',
      biometryUsed: biometricType,
      credentialID,
      rawClientDataJSON: rawClientDataJSONBase64Url,
      rawAttestationObject,
      attestationFormat: 'none',
    },
    swiftInspectionSnippet,
    wireSnapshot: {
      flow: 'Mock Passkey Registration Payload (Inspection)',
      protocol: 'WebAuthn / FIDO2',
      timestamp: generatedAt,
      challenge,
      rpId,
      flags: { UP: true, UV: true, BE: true, BS: true, AT: true },
      rawPayload,
    },
  };
}
