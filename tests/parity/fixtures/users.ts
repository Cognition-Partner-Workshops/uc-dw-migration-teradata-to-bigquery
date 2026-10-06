/**
 * Apex `System.runAs(user)` → bearer tokens for users in the matching Cognito groups
 * (docs/migration/mapping.yaml, conventions.auth). The fixtures live with the API so its
 * own permission matrix (app/api/test/permissions.e2e.spec.ts) and the parity suites use
 * the same users and signing secret; see app/api/test/support/test-users.ts.
 */
export {
  TEST_ISSUER,
  TEST_JWT_SECRET,
  adminUser,
  asUser,
  guestUser,
  mintAccessToken,
  otherGroupUser,
  standardUser,
  type MintOptions,
  type TestUser,
} from 'dreamhouse-api/test/support/test-users';
