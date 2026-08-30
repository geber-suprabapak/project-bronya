import type { IdTokenClaims } from "@logto/next";

export type BronyaRole =
  | "platform_admin"
  | "school_admin"
  | "staff"
  | "teacher"
  | "student";

export type ExtendedLogtoClaims = IdTokenClaims & {
  readonly roles?: readonly string[];
};

const ROLE_PRIORITY: readonly BronyaRole[] = [
  "platform_admin",
  "school_admin",
  "staff",
  "teacher",
  "student",
];

const KIOSK_OPERATOR_ROLES = new Set<BronyaRole>([
  "platform_admin",
  "school_admin",
  "staff",
  "teacher",
]);

export function resolveLogtoRole(
  roles?: readonly string[] | null,
): BronyaRole | null {
  if (!roles) return null;

  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) return role;
  }

  return null;
}

export function isKioskOperatorRole(
  role: BronyaRole | null | undefined,
): boolean {
  return role != null && KIOSK_OPERATOR_ROLES.has(role);
}

export function extractExtendedClaims(
  claims: IdTokenClaims | null | undefined,
): ExtendedLogtoClaims | null {
  return claims ? (claims as ExtendedLogtoClaims) : null;
}
