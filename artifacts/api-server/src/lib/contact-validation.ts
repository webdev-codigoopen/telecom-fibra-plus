// Shared field validation for the public Contact form.
// Mirrored on the frontend (artifacts/provider-mais-fibra/src/lib/contactValidation.ts)
// — keep both files in sync.

export const VALID_BR_DDDS = new Set<number>([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35,
  37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64,
  65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88,
  89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export const VALID_REASONS = new Set<string>([
  "Quero assinar um plano",
  "Suporte técnico",
  "2ª via de boleto",
  "Cancelamento",
  "Alterar plano",
  "Reclamação",
  "Outro",
  "Informações sobre planos",
]);

export const NAME_MAX = 80;
export const EMAIL_MAX = 254;
export const CITY_MAX = 80;
export const REASON_MAX = 60;
export const MESSAGE_MAX = 1000;

const NAME_ALLOWED_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ' \-.]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REPEAT_RE = /(.)\1{3,}/;
const SCRIPT_RE = /<\s*\/?\s*(script|iframe|object|embed|svg|style)\b/i;
const JS_PROTO_RE = /\b(javascript|data|vbscript)\s*:/i;
const EVENT_HANDLER_RE = /\bon[a-z]+\s*=\s*["']?[^"'>\s]/i;
const SQL_TOKENS_RE =
  /\b(union\s+select|select\s+.*\s+from|insert\s+into|update\s+\w+\s+set|delete\s+from|drop\s+(table|database)|--\s|;\s*--)\b/i;
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;

export function stripControlChars(s: string): string {
  // Remove control chars, zero-width, and BOM. Keep newlines/tabs.
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\uFEFF]/g, "");
}

export function normalizeWhitespace(s: string, allowNewlines = false): string {
  if (allowNewlines) {
    return s.replace(/[\t \xA0]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }
  return s.replace(/\s+/g, " ").trim();
}

export type FieldError = { field: string; message: string };

export function validateName(input: unknown): FieldError | null {
  if (typeof input !== "string") return { field: "name", message: "Informe seu nome." };
  const v = normalizeWhitespace(stripControlChars(input));
  if (v.length < 4) return { field: "name", message: "Nome muito curto." };
  if (v.length > NAME_MAX) return { field: "name", message: "Nome muito longo." };
  if (!NAME_ALLOWED_RE.test(v))
    return { field: "name", message: "Use apenas letras, espaços e hífens." };
  if (REPEAT_RE.test(v))
    return { field: "name", message: "Caracteres repetidos demais." };
  const parts = v.split(" ").filter((p) => p.length > 0);
  if (parts.length < 2)
    return { field: "name", message: "Informe nome e sobrenome." };
  if (parts.some((p) => p.length < 2))
    return { field: "name", message: "Cada parte do nome deve ter ao menos 2 letras." };
  return null;
}

export function validateEmail(input: unknown): FieldError | null {
  if (typeof input !== "string") return { field: "email", message: "Informe um e-mail." };
  const v = stripControlChars(input).trim().toLowerCase();
  if (v.length === 0) return { field: "email", message: "Informe um e-mail." };
  if (v.length > EMAIL_MAX) return { field: "email", message: "E-mail muito longo." };
  if (!EMAIL_RE.test(v)) return { field: "email", message: "E-mail inválido." };
  return null;
}

export function extractWhatsappDigits(input: unknown): string {
  if (typeof input !== "string") return "";
  return stripControlChars(input).replace(/\D/g, "");
}

export function validateWhatsapp(input: unknown): FieldError | null {
  const digits = extractWhatsappDigits(input);
  if (digits.length === 0) return { field: "phone", message: "Informe seu WhatsApp." };
  // Strip optional country code 55
  const local = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  if (local.length < 10 || local.length > 11)
    return { field: "phone", message: "Telefone deve ter 10 ou 11 dígitos com DDD." };
  const ddd = parseInt(local.slice(0, 2), 10);
  if (!VALID_BR_DDDS.has(ddd))
    return { field: "phone", message: "DDD inválido." };
  // Mobile (11 digits) must start with 9 in third digit
  if (local.length === 11 && local[2] !== "9")
    return { field: "phone", message: "Celular deve começar com 9 após o DDD." };
  // Fixed line (10 digits) third digit between 2 and 5
  if (local.length === 10) {
    const c = local[2];
    if (!c || c < "2" || c > "5")
      return { field: "phone", message: "Telefone fixo inválido." };
  }
  // Reject obviously fake (all same digit)
  if (/^(\d)\1+$/.test(local))
    return { field: "phone", message: "Telefone inválido." };
  return null;
}

export function validateCity(input: unknown, allowed: string[]): FieldError | null {
  if (typeof input !== "string") return { field: "city", message: "Selecione sua cidade." };
  const v = stripControlChars(input).trim().slice(0, CITY_MAX);
  if (v.length === 0) return { field: "city", message: "Selecione sua cidade." };
  if (!allowed.includes(v)) return { field: "city", message: "Cidade inválida." };
  return null;
}

export function validateReason(input: unknown): FieldError | null {
  if (typeof input !== "string") return { field: "reason", message: "Selecione um assunto." };
  const v = stripControlChars(input).trim().slice(0, REASON_MAX);
  if (v.length === 0) return { field: "reason", message: "Selecione um assunto." };
  if (!VALID_REASONS.has(v)) return { field: "reason", message: "Assunto inválido." };
  return null;
}

export function validateMessage(input: unknown): FieldError | null {
  if (input == null || input === "") return null; // optional
  if (typeof input !== "string")
    return { field: "message", message: "Mensagem inválida." };
  const v = normalizeWhitespace(stripControlChars(input), true);
  if (v.length === 0) return null;
  if (v.length < 5)
    return { field: "message", message: "Mensagem muito curta." };
  if (v.length > MESSAGE_MAX)
    return { field: "message", message: "Mensagem muito longa." };
  if (REPEAT_RE.test(v))
    return { field: "message", message: "Caracteres repetidos demais." };
  if (SCRIPT_RE.test(v) || JS_PROTO_RE.test(v) || EVENT_HANDLER_RE.test(v))
    return { field: "message", message: "Mensagem contém código não permitido." };
  if (SQL_TOKENS_RE.test(v))
    return { field: "message", message: "Mensagem contém comandos não permitidos." };
  const urlMatches = v.match(URL_RE) ?? [];
  if (urlMatches.length > 2)
    return { field: "message", message: "Muitos links na mensagem." };
  return null;
}

export function sanitizeMessage(input: string): string {
  return normalizeWhitespace(stripControlChars(input), true).slice(0, MESSAGE_MAX);
}

export function sanitizeName(input: string): string {
  return normalizeWhitespace(stripControlChars(input)).slice(0, NAME_MAX);
}
