// Frontend mirror of artifacts/api-server/src/lib/contact-validation.ts.
// Keep both files in sync so client- and server-side rules match exactly.

export const VALID_BR_DDDS = new Set<number>([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35,
  37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64,
  65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88,
  89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

const NAME_ALLOWED_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ' \-.]+$/;
const NAME_ALLOWED_CHAR_RE = /[A-Za-zÀ-ÖØ-öø-ÿ' \-.]/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REPEAT_RE = /(.)\1{3,}/;
const SCRIPT_RE = /<\s*\/?\s*(script|iframe|object|embed|svg|style)\b/i;
const JS_PROTO_RE = /\b(javascript|data|vbscript)\s*:/i;
const EVENT_HANDLER_RE = /\bon[a-z]+\s*=\s*["']?[^"'>\s]/i;
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;

export const NAME_MAX = 80;
export const EMAIL_MAX = 254;
export const MESSAGE_MAX = 1000;

export function sanitizeNameInput(value: string): string {
  // Strip anything that isn't a Latin letter, space, hyphen, apostrophe or dot.
  // Then collapse whitespace.
  const filtered = Array.from(value)
    .filter((c) => NAME_ALLOWED_CHAR_RE.test(c))
    .join("");
  return filtered.replace(/\s{2,}/g, " ").slice(0, NAME_MAX);
}

export function maskWhatsappInput(value: string, previous = ""): string {
  // Returns a value formatted as (XX) XXXXX-XXXX, blocking entry if the DDD
  // turns out to be invalid. Pass the previous sanitized value so we can roll
  // back the change when the new digits would be invalid.
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length >= 2) {
    const ddd = parseInt(digits.slice(0, 2), 10);
    if (!VALID_BR_DDDS.has(ddd)) {
      // Keep only the first valid digit so the user can retry.
      return previous || digits.slice(0, 1);
    }
  }
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function whatsappDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export type FieldError = string | null;

export function validateName(value: string): FieldError {
  const v = value.trim();
  if (v.length === 0) return "Informe seu nome.";
  if (v.length < 4) return "Nome muito curto.";
  if (v.length > NAME_MAX) return "Nome muito longo.";
  if (!NAME_ALLOWED_RE.test(v))
    return "Use apenas letras, espaços e hífens.";
  if (REPEAT_RE.test(v)) return "Caracteres repetidos demais.";
  const parts = v.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return "Informe nome e sobrenome.";
  if (parts.some((p) => p.length < 2))
    return "Cada parte do nome deve ter ao menos 2 letras.";
  return null;
}

export function validateEmail(value: string): FieldError {
  const v = value.trim();
  if (v.length === 0) return "Informe um e-mail.";
  if (v.length > EMAIL_MAX) return "E-mail muito longo.";
  if (!EMAIL_RE.test(v)) return "E-mail inválido.";
  return null;
}

export function validateWhatsapp(value: string): FieldError {
  const digits = whatsappDigits(value);
  if (digits.length === 0) return "Informe seu WhatsApp.";
  if (digits.length < 10) return "Telefone incompleto.";
  if (digits.length > 11) return "Telefone muito longo.";
  const ddd = parseInt(digits.slice(0, 2), 10);
  if (!VALID_BR_DDDS.has(ddd)) return "DDD inválido.";
  if (digits.length === 11 && digits[2] !== "9")
    return "Celular deve começar com 9 após o DDD.";
  if (digits.length === 10) {
    const c = digits[2];
    if (!c || c < "2" || c > "5") return "Telefone fixo inválido.";
  }
  if (/^(\d)\1+$/.test(digits)) return "Telefone inválido.";
  return null;
}

export function validateCity(value: string): FieldError {
  if (!value || value.trim().length === 0) return "Selecione sua cidade.";
  return null;
}

export function validateReason(value: string): FieldError {
  if (!value || value.trim().length === 0) return "Selecione um assunto.";
  return null;
}

export function validateMessage(value: string): FieldError {
  const v = value.trim();
  if (v.length === 0) return null; // optional
  if (v.length < 5) return "Mensagem muito curta.";
  if (v.length > MESSAGE_MAX) return "Mensagem muito longa.";
  if (REPEAT_RE.test(v)) return "Caracteres repetidos demais.";
  if (SCRIPT_RE.test(v) || JS_PROTO_RE.test(v) || EVENT_HANDLER_RE.test(v))
    return "Mensagem contém código não permitido.";
  const urls = v.match(URL_RE) ?? [];
  if (urls.length > 2) return "Muitos links na mensagem.";
  return null;
}
