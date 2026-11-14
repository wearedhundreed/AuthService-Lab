export type NavSection = 'biometrics' | 'passwords' | 'aasa' | 'email' | 'swift' | 'assistant';

export type DeviceTarget = 'iphone-12-pro' | 'iphone-16-pro';

export type BiometricType = 'faceId' | 'touchId' | 'passcode';

export type BiometricOutcome =
  | 'success'
  | 'mismatch'
  | 'userCancel'
  | 'lockout'
  | 'biometryNotEnrolled';

export type AuthKind = 'passkey' | 'password' | 'siwa';

export type SecurityAuditStatus = 'strong' | 'reused' | 'weak';

export interface CredentialEntry {
  id: string;
  title: string;
  domain: string;
  username: string;
  password: string;
  authKind: AuthKind;
  hasPasskey: boolean;
  passkeyId?: string;
  passkeyPublicKey?: string;
  passkeySignCount: number;
  totpSecret?: string;
  sharedGroup?: string;
  notes?: string;
  isPrivateRelay?: boolean;
  auditStatus: SecurityAuditStatus;
  auditIssues: string[];
  entropyBits: number;
  lastUsedAt: string;
  updatedAt: string;
}

export interface AuthLogEntry {
  id: string;
  timestamp: string;
  framework: 'AuthenticationServices' | 'LocalAuthentication' | 'Security.Keychain' | 'Passwords.AutoFill';
  operation: string;
  domain: string;
  biometricType: BiometricType;
  statusCode: string;
  success: boolean;
  latencyMs: number;
  detail: string;
}

export interface WirePayloadSnapshot {
  flow: string;
  protocol: 'WebAuthn / FIDO2' | 'Sign in with Apple (OIDC)' | 'AutoFill Credential' | 'LAContext Policy';
  timestamp: string;
  challenge?: string;
  rpId?: string;
  flags?: {
    UP: boolean;
    UV: boolean;
    BE: boolean;
    BS: boolean;
    AT: boolean;
  };
  rawPayload: Record<string, unknown>;
}

export interface AasaValidationDiagnostic {
  level: 'pass' | 'warning' | 'error';
  field: string;
  message: string;
}

export interface AasaValidationResult {
  valid: boolean;
  byteSize: number;
  maxBytes: number;
  webcredentialsApps: string[];
  applinksApps: string[];
  diagnostics: AasaValidationDiagnostic[];
  matchedUrlResult?: {
    url: string;
    matchedWebCredentials: boolean;
    matchedAppLinks: boolean;
    matchedRule?: string;
  };
}

export interface TestCaseResult {
  id: string;
  name: string;
  category: 'Biometrics' | 'Passkeys' | 'Passwords' | 'AASA';
  passed: boolean;
  durationMs: number;
  assertion: string;
  apiSymbol: string;
}

export interface TestSuiteResponse {
  executedAt: string;
  total: number;
  passed: number;
  failed: number;
  totalDurationMs: number;
  results: TestCaseResult[];
}

export interface SwiftFileItem {
  filename: string;
  path: string;
  framework: string;
  summary: string;
  code: string;
}

export interface PasswordGeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  appleFormat: boolean;
}

export type ChatTaskMode = 'fast' | 'general' | 'complex' | 'deep';

export type AssistantRole = 'security-architect' | 'autofill-specialist' | 'xcode-debugger';

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'model';
  text: string;
  model: string;
  taskMode: ChatTaskMode;
  assistantRole: AssistantRole;
  createdAt: string;
}

export type EmailFolder = 'inbox' | 'sent' | 'drafts' | 'relay';

export type EmailProviderId =
  | 'mailto'
  | 'gmail'
  | 'outlook'
  | 'icloud'
  | 'proton'
  | 'fastmail'
  | 'yahoo';

export interface UniversalEmailMessage {
  id: string;
  folder: EmailFolder;
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  body: string;
  providerHint: EmailProviderId;
  otpCode?: string;
  magicLinkUrl?: string;
  isRead: boolean;
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;
}
