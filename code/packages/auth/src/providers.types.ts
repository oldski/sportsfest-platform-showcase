// Showcase note: provider ids as a union-backed enum shared by the sign-in UI and the config.

export enum Provider {
  Credentials = 'credentials',
  TotpCode = 'totp-code',
  RecoveryCode = 'recovery-code',
  Google = 'google',
  MicrosoftEntraId = 'microsoft-entra-id'
}

export enum OAuthProvider {
  Google = Provider.Google,
  MicrosoftEntraId = Provider.MicrosoftEntraId
}
