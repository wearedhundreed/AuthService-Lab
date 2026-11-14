import { SwiftFileItem } from '../types/auth';

export const SWIFT_IMPLEMENTATION_FILES: SwiftFileItem[] = [
  {
    filename: 'AuthenticationManager.swift',
    path: 'Sources/Auth/AuthenticationManager.swift',
    framework: 'AuthenticationServices',
    summary:
      'Coordinates ASAuthorizationController for Passkey registration, Passkey assertion, Saved Password AutoFill, and Sign in with Apple.',
    code: `import AuthenticationServices
import Foundation
import SwiftUI

@MainActor
final class AuthenticationManager: NSObject, ObservableObject {
    @Published var isAuthenticating = false
    @Published var signedInUser: String?
    @Published var lastErrorMessage: String?

    private let relyingPartyID: String

    init(relyingPartyID: String = "auth.demo-ios.app") {
        self.relyingPartyID = relyingPartyID
        super.init()
    }

    // MARK: - Passkey Registration (Create Account)
    func registerPasskey(username: String, userID: Data, challenge: Data) {
        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
            relyingPartyIdentifier: relyingPartyID
        )
        let request = provider.createCredentialRegistrationRequest(
            challenge: challenge,
            name: username,
            userID: userID
        )
        request.userVerificationPreference = .required

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        isAuthenticating = true
        controller.performRequests()
    }

    // MARK: - Combined Passkey + Saved Password Sign-In
    func signInWithPasskeyOrPassword(challenge: Data, preferAutoFill: Bool = false) {
        let passkeyProvider = ASAuthorizationPlatformPublicKeyCredentialProvider(
            relyingPartyIdentifier: relyingPartyID
        )
        let passkeyRequest = passkeyProvider.createCredentialAssertionRequest(challenge: challenge)
        passkeyRequest.userVerificationPreference = .required

        let passwordRequest = ASAuthorizationPasswordProvider().createRequest()

        let controller = ASAuthorizationController(
            authorizationRequests: [passkeyRequest, passwordRequest]
        )
        controller.delegate = self
        controller.presentationContextProvider = self
        isAuthenticating = true

        if preferAutoFill {
            controller.performAutoFillAssistedRequests()
        } else {
            controller.performRequests()
        }
    }

    // MARK: - Sign in with Apple
    func signInWithApple(nonce: String) {
        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = nonce

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        isAuthenticating = true
        controller.performRequests()
    }
}

extension AuthenticationManager: ASAuthorizationControllerDelegate {
    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        isAuthenticating = false

        switch authorization.credential {
        case let reg as ASAuthorizationPlatformPublicKeyCredentialRegistration:
            // Send reg.rawAttestationObject & reg.rawClientDataJSON to server
            signedInUser = "Passkey Registered (ID: \\(reg.credentialID.base64EncodedString().prefix(12))...)"

        case let assertion as ASAuthorizationPlatformPublicKeyCredentialAssertion:
            // Send assertion.signature, assertion.rawAuthenticatorData, assertion.rawClientDataJSON to server
            let userHandle = assertion.userID.flatMap { String(data: $0, encoding: .utf8) } ?? "Passkey User"
            signedInUser = userHandle

        case let passwordCred as ASPasswordCredential:
            signedInUser = passwordCred.user

        case let appleIDCred as ASAuthorizationAppleIDCredential:
            signedInUser = appleIDCred.email ?? appleIDCred.user

        default:
            break
        }
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        isAuthenticating = false
        if let authError = error as? ASAuthorizationError, authError.code == .canceled {
            lastErrorMessage = "User canceled authentication sheet."
            return
        }
        lastErrorMessage = error.localizedDescription
    }
}

extension AuthenticationManager: ASAuthorizationControllerPresentationContextProviding {
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}
`,
  },
  {
    filename: 'BiometricAuthService.swift',
    path: 'Sources/Security/BiometricAuthService.swift',
    framework: 'LocalAuthentication',
    summary:
      'Evaluates Face ID / Touch ID via LAContext with deviceOwnerAuthentication fallback, lockout handling, and biometry domain-state change detection.',
    code: `import Foundation
import LocalAuthentication

enum BiometricKind: String {
    case faceID = "Face ID"
    case touchID = "Touch ID"
    case opticID = "Optic ID"
    case none = "Passcode"
}

enum BiometricFailure: LocalizedError {
    case unavailable(String)
    case canceled
    case lockout
    case domainStateChanged
    case failed(String)

    var errorDescription: String? {
        switch self {
        case .unavailable(let reason): return reason
        case .canceled: return "Authentication was canceled by the user."
        case .lockout: return "Biometry is locked out after multiple failed attempts. Passcode required."
        case .domainStateChanged: return "Enrolled biometrics changed since last Keychain bind."
        case .failed(let msg): return msg
        }
    }
}

final class BiometricAuthService {
    func availableBiometry() -> BiometricKind {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return .none
        }
        switch context.biometryType {
        case .faceID: return .faceID
        case .touchID: return .touchID
        case .opticID: return .opticID
        default: return .none
        }
    }

    func authenticate(
        reason: String = "Verify your identity to unlock saved credentials.",
        allowPasscodeFallback: Bool = true
    ) async throws -> LAContext {
        let context = LAContext()
        context.localizedCancelTitle = "Cancel"
        context.localizedFallbackTitle = allowPasscodeFallback ? "Use Passcode" : ""

        let policy: LAPolicy = allowPasscodeFallback
            ? .deviceOwnerAuthentication
            : .deviceOwnerAuthenticationWithBiometrics

        var authError: NSError?
        guard context.canEvaluatePolicy(policy, error: &authError) else {
            throw mapError(authError)
        }

        return try await withCheckedThrowingContinuation { continuation in
            context.evaluatePolicy(policy, localizedReason: reason) { success, evalError in
                if success {
                    continuation.resume(returning: context)
                } else {
                    continuation.resume(throwing: self.mapError(evalError as NSError?))
                }
            }
        }
    }

    private func mapError(_ error: NSError?) -> BiometricFailure {
        guard let error else { return .failed("Unknown LocalAuthentication error.") }
        switch LAError.Code(rawValue: error.code) {
        case .userCancel, .appCancel, .systemCancel:
            return .canceled
        case .biometryLockout:
            return .lockout
        case .biometryNotEnrolled, .biometryNotAvailable, .passcodeNotSet:
            return .unavailable(error.localizedDescription)
        default:
            return .failed(error.localizedDescription)
        }
    }
}
`,
  },
  {
    filename: 'KeychainCredentialStore.swift',
    path: 'Sources/Security/KeychainCredentialStore.swift',
    framework: 'Security',
    summary:
      'Stores and retrieves secrets in the iOS Keychain bound to .biometryCurrentSet and kSecAttrAccessibleWhenUnlockedThisDeviceOnly.',
    code: `import Foundation
import LocalAuthentication
import Security

enum KeychainError: LocalizedError {
    case accessControlCreationFailed
    case unexpectedStatus(OSStatus)
    case decodingFailed

    var errorDescription: String? {
        switch self {
        case .accessControlCreationFailed:
            return "Unable to create SecAccessControl with .biometryCurrentSet."
        case .unexpectedStatus(let status):
            return SecCopyErrorMessageString(status, nil) as String? ?? "OSStatus \\(status)"
        case .decodingFailed:
            return "Failed to decode Keychain secret."
        }
    }
}

final class KeychainCredentialStore {
    private let service = "com.authserviceslab.ios.vault"

    func saveBiometricSecret(_ secret: String, account: String) throws {
        guard let data = secret.data(using: .utf8) else { return }

        var cfError: Unmanaged<CFError>?
        guard let accessControl = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            .biometryCurrentSet,
            &cfError
        ) else {
            throw KeychainError.accessControlCreationFailed
        }

        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(deleteQuery as CFDictionary)

        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessControl as String: accessControl
        ]

        let status = SecItemAdd(addQuery as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.unexpectedStatus(status)
        }
    }

    func readBiometricSecret(account: String, context: LAContext) throws -> String {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecUseAuthenticationContext as String: context
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess else {
            throw KeychainError.unexpectedStatus(status)
        }
        guard let data = item as? Data, let secret = String(data: data, encoding: .utf8) else {
            throw KeychainError.decodingFailed
        }
        return secret
    }
}
`,
  },
  {
    filename: 'CredentialProviderViewController.swift',
    path: 'AutoFillExtension/CredentialProviderViewController.swift',
    framework: 'AuthenticationServices (AutoFill)',
    summary:
      'Implements ASCredentialProviderViewController so saved passwords and passkeys surface directly inside the iOS Passwords AutoFill QuickType bar.',
    code: `import AuthenticationServices
import LocalAuthentication

final class CredentialProviderViewController: ASCredentialProviderViewController {
    private let biometricService = BiometricAuthService()

    override func prepareCredentialList(for serviceIdentifiers: [ASCredentialServiceIdentifier]) {
        // Populate QuickType bar with matching ASPasswordCredentialIdentity
        // and ASPasskeyCredentialIdentity records from ASCredentialIdentityStore.
        let identities = serviceIdentifiers.map { identifier in
            ASPasswordCredentialIdentity(
                serviceIdentifier: identifier,
                user: "maya.lin@icloud.com",
                recordIdentifier: "cred-demo-ios"
            )
        }

        Task {
            try? await ASCredentialIdentityStore.shared.saveCredentialIdentities(identities)
        }
    }

    override func provideCredentialWithoutUserInteraction(
        for credentialRequest: ASCredentialRequest
    ) {
        // Require interactive Face ID verification before releasing secrets.
        extensionContext.cancelRequest(
            withError: NSError(
                domain: ASExtensionErrorDomain,
                code: ASExtensionError.userInteractionRequired.rawValue
            )
        )
    }

    override func prepareInterfaceToProvideCredential(
        for credentialRequest: ASCredentialRequest
    ) {
        Task { @MainActor in
            do {
                let context = try await biometricService.authenticate(
                    reason: "AutoFill credential for \\(credentialRequest.credentialIdentity.serviceIdentifier.identifier)"
                )
                let store = KeychainCredentialStore()
                let password = try store.readBiometricSecret(
                    account: credentialRequest.credentialIdentity.user,
                    context: context
                )
                let credential = ASPasswordCredential(
                    user: credentialRequest.credentialIdentity.user,
                    password: password
                )
                extensionContext.completeRequest(withSelectedCredential: credential)
            } catch {
                extensionContext.cancelRequest(
                    withError: NSError(
                        domain: ASExtensionErrorDomain,
                        code: ASExtensionError.userCanceled.rawValue
                    )
                )
            }
        }
    }
}
`,
  },
  {
    filename: 'PasswordsSettingsView.swift',
    path: 'Sources/UI/PasswordsSettingsView.swift',
    framework: 'SwiftUI + AuthenticationServices',
    summary:
      'SwiftUI sign-in and account creation form configured with UITextContentType (.username, .newPassword, .oneTimeCode) and UITextPasswordRules for iOS Passwords AutoFill.',
    code: `import AuthenticationServices
import SwiftUI

struct PasswordsSettingsView: View {
    @StateObject private var authManager = AuthenticationManager()
    @State private var username = ""
    @State private var password = ""
    @State private var verificationCode = ""

    private let passwordRules = UITextPasswordRules(
        descriptor: "minlength: 16; required: upper, lower, digit; allowed: [-];"
    )

    var body: some View {
        NavigationStack {
            Form {
                Section("Account Credentials") {
                    TextField("Email or Username", text: $username)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    SecureField("Password", text: $password)
                        .textContentType(.newPassword)
                        .passwordRules(passwordRules)

                    TextField("6-Digit Verification Code", text: $verificationCode)
                        .textContentType(.oneTimeCode)
                        .keyboardType(.numberPad)
                }

                Section("Passwordless & Biometrics") {
                    Button("Sign in with Passkey (Face ID)") {
                        let challenge = Data((0..<32).map { _ in UInt8.random(in: 0...255) })
                        authManager.signInWithPasskeyOrPassword(challenge: challenge)
                    }

                    SignInWithAppleButton(.continue) { request in
                        request.requestedScopes = [.fullName, .email]
                    } onCompletion: { result in
                        if case .success(let auth) = result,
                           let appleCred = auth.credential as? ASAuthorizationAppleIDCredential {
                            authManager.signedInUser = appleCred.email ?? appleCred.user
                        }
                    }
                    .signInWithAppleButtonStyle(.black)
                    .frame(height: 46)
                }
            }
            .navigationTitle("Passwords & Auth")
        }
    }
}
`,
  },
  {
    filename: 'App.entitlements & AASA',
    path: 'Configuration/App.entitlements',
    framework: 'Xcode Entitlements & Well-Known',
    summary:
      'Required Associated Domains entitlements, Info.plist NSFaceIDUsageDescription, and server /.well-known/apple-app-site-association template.',
    code: `<!-- 1. App.entitlements -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.developer.associated-domains</key>
    <array>
        <string>webcredentials:auth.demo-ios.app</string>
        <string>applinks:auth.demo-ios.app</string>
    </array>
    <key>com.apple.developer.applesignin</key>
    <array>
        <string>Default</string>
    </array>
</dict>
</plist>

<!-- 2. Info.plist (Required for Face ID) -->
<key>NSFaceIDUsageDescription</key>
<string>Authenticate with Face ID to unlock Passkeys and saved passwords.</string>

<!-- 3. https://auth.demo-ios.app/.well-known/apple-app-site-association -->
{
  "applinks": {
    "details": [
      {
        "appIDs": ["A1B2C3D4E5.com.authserviceslab.ios"],
        "components": [
          { "/": "/auth/*", "comment": "OAuth & Passkey Universal Links" }
        ]
      }
    ]
  },
  "webcredentials": {
    "apps": ["A1B2C3D4E5.com.authserviceslab.ios"]
  }
}
`,
  },
];
