export type AdminRole = "owner" | "manager" | "sales" | "content" | "viewer";

export type AdminPermission =
  | "property.manage"
  | "property.publish"
  | "lead.manage"
  | "finance.manage"
  | "content.manage"
  | "settings.manage"
  | "backup.manage"
  | "security.manage"
  | "accounts.manage"
  | "reports.view"
  | "deal.manage"
  | "commission.manage";

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  owner: "مالک سیستم",
  manager: "مدیر اجرایی",
  sales: "فروش و CRM",
  content: "محتوا و فایل‌ها",
  viewer: "مشاهده‌گر",
};

export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  owner: [
    "property.manage",
    "property.publish",
    "lead.manage",
    "finance.manage",
    "content.manage",
    "settings.manage",
    "backup.manage",
    "security.manage",
    "accounts.manage",
    "reports.view",
    "deal.manage",
    "commission.manage",
  ],
  manager: [
    "property.manage",
    "property.publish",
    "lead.manage",
    "finance.manage",
    "content.manage",
    "settings.manage",
    "backup.manage",
    "security.manage",
    "reports.view",
    "deal.manage",
    "commission.manage",
  ],
  sales: ["property.manage", "lead.manage", "reports.view", "deal.manage", "commission.manage"],
  content: ["property.manage", "content.manage", "reports.view"],
  viewer: ["reports.view"],
};

export function normalizeAdminRole(value: unknown): AdminRole {
  switch (value) {
    case "owner":
    case "manager":
    case "sales":
    case "content":
    case "viewer":
      return value;
    case "admin":
    default:
      return "owner";
  }
}

export function hasAdminPermission(role: AdminRole, permission: AdminPermission) {
  return ADMIN_ROLE_PERMISSIONS[role].includes(permission);
}
