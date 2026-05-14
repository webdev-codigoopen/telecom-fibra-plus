import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Gift,
  Users,
  Wifi,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Send,
  Sparkles,
} from "lucide-react";
import SEO from "@/components/SEO";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import WhatsAppFloat from "@/components/sections/WhatsAppFloat";
import friendsImage from "@assets/amigos_1778782009998.png";
import {
  maskWhatsappInput,
  sanitizeNameInput,
  validateName,
  validateWhatsapp,
} from "@/lib/contactValidation";

const BASE = import.meta.env.BASE_URL;
const API_BASE = BASE.replace(/\/$/, "");

const FONT_NUNITO = "'Nunito', system-ui, sans-serif";
const FONT_MONTSERRAT = "'Montserrat', system-ui, sans-serif";

const COLOR_PRIMARY = "#122AD5";
const COLOR_PRIMARY_DARK = "#0A1FA8";
const COLOR_PRIMARY_LIGHT = "#1A38D5";
const COLOR_GREEN = "#95EB1D";
const COLOR_GREEN_TEXT = "#2A40DA";
const COLOR_HEADING = "#003F99";
const COLOR_TEXT = "#0D0E14";
const COLOR_SUBTLE = "#4A4F61";
const COLOR_BORDER = "#E2E5EF";
const COLOR_ERROR = "#D02929";

const cityOptions = [
  "Barreiras",
  "Luís Eduardo Magalhães",
  "Correntina",
  "Wanderley",
  "Santa Rita de Cássia",
  "Barra",
  "Buritirama",
  "Mansidão",
  "Múquem de São Francisco",
  "Posto Rosário",
  "Roda Velha",
  "Javi",
];

type Person = {
  nome: string;
  telefone: string;
  cidade: string;
  cpf: string;
};

type FormState = {
  indicador: Person;
  amigo: Person;
  accept: boolean;
  website: string; // honeypot
};

type FormErrors = {
  indicadorNome?: string | null;
  indicadorTelefone?: string | null;
  indicadorCidade?: string | null;
  indicadorCpf?: string | null;
  amigoNome?: string | null;
  amigoTelefone?: string | null;
  amigoCidade?: string | null;
  amigoCpf?: string | null;
  accept?: string | null;
  general?: string | null;
};

const EMPTY_PERSON: Person = { nome: "", telefone: "", cidade: "", cpf: "" };

function maskCpfInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function validateCpf(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "Informe seu CPF.";
  if (digits.length !== 11) return "CPF deve ter 11 dígitos.";
  if (/^(\d)\1+$/.test(digits)) return "CPF inválido.";
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]!, 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(digits[9]!, 10)) return "CPF inválido.";
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]!, 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  if (d2 !== parseInt(digits[10]!, 10)) return "CPF inválido.";
  return null;
}

function validateCity(value: string): string | null {
  if (!value) return "Selecione uma cidade.";
  if (!cityOptions.includes(value)) return "Cidade inválida.";
  return null;
}

function validatePerson(p: Person, prefix: "indicador" | "amigo"): FormErrors {
  const errs: FormErrors = {};
  errs[`${prefix}Nome` as keyof FormErrors] = validateName(p.nome);
  errs[`${prefix}Telefone` as keyof FormErrors] = validateWhatsapp(p.telefone);
  errs[`${prefix}Cidade` as keyof FormErrors] = validateCity(p.cidade);
  errs[`${prefix}Cpf` as keyof FormErrors] = validateCpf(p.cpf);
  return errs;
}

function nonNull(errs: FormErrors): boolean {
  return Object.values(errs).some((v) => v != null && v !== "");
}

const FieldLabel = ({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) => (
  <label
    htmlFor={htmlFor}
    style={{
      fontFamily: FONT_NUNITO,
      fontWeight: 700,
      fontSize: 13,
      lineHeight: "18px",
      color: COLOR_TEXT,
      marginBottom: 6,
      display: "block",
    }}
  >
    {children}
  </label>
);

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: "100%",
  height: 44,
  paddingLeft: 14,
  paddingRight: 14,
  borderRadius: 10,
  border: `1px solid ${hasError ? COLOR_ERROR : COLOR_BORDER}`,
  background: "#FFFFFF",
  fontFamily: FONT_NUNITO,
  fontWeight: 500,
  fontSize: 14,
  lineHeight: "20px",
  color: COLOR_TEXT,
  outline: "none",
  transition: "border-color 0.15s ease",
  boxSizing: "border-box",
});

const FieldError = ({ id, msg }: { id?: string; msg?: string | null }) =>
  msg ? (
    <div
      id={id}
      role="alert"
      style={{
        marginTop: 6,
        display: "flex",
        alignItems: "center",
        gap: 6,
        color: COLOR_ERROR,
        fontFamily: FONT_NUNITO,
        fontSize: 12,
        lineHeight: "16px",
        fontWeight: 600,
      }}
    >
      <AlertCircle size={14} aria-hidden />
      <span>{msg}</span>
    </div>
  ) : null;

type PersonFieldsProps = {
  prefix: "indicador" | "amigo";
  value: Person;
  errors: FormErrors;
  onChange: (next: Person) => void;
  onBlur: (field: keyof Person) => void;
};

function PersonFields({ prefix, value, errors, onChange, onBlur }: PersonFieldsProps) {
  const idNome = `${prefix}-nome`;
  const idTel = `${prefix}-telefone`;
  const idCidade = `${prefix}-cidade`;
  const idCpf = `${prefix}-cpf`;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 14,
      }}
      className="referral-grid"
    >
      <div style={{ gridColumn: "1 / -1" }}>
        <FieldLabel htmlFor={idNome}>Nome completo</FieldLabel>
        <input
          id={idNome}
          name={idNome}
          type="text"
          autoComplete="name"
          placeholder="Ex.: Maria da Silva"
          data-testid={`input-${idNome}`}
          value={value.nome}
          onChange={(e) =>
            onChange({ ...value, nome: sanitizeNameInput(e.target.value) })
          }
          onBlur={() => onBlur("nome")}
          aria-invalid={!!errors[`${prefix}Nome` as keyof FormErrors]}
          aria-describedby={errors[`${prefix}Nome` as keyof FormErrors] ? `${idNome}-err` : undefined}
          style={inputStyle(!!errors[`${prefix}Nome` as keyof FormErrors])}
        />
        <FieldError id={`${idNome}-err`} msg={errors[`${prefix}Nome` as keyof FormErrors]} />
      </div>

      <div>
        <FieldLabel htmlFor={idTel}>WhatsApp</FieldLabel>
        <input
          id={idTel}
          name={idTel}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(77) 99999-9999"
          data-testid={`input-${idTel}`}
          value={value.telefone}
          onChange={(e) =>
            onChange({
              ...value,
              telefone: maskWhatsappInput(e.target.value, value.telefone),
            })
          }
          onBlur={() => onBlur("telefone")}
          aria-invalid={!!errors[`${prefix}Telefone` as keyof FormErrors]}
          aria-describedby={errors[`${prefix}Telefone` as keyof FormErrors] ? `${idTel}-err` : undefined}
          style={inputStyle(!!errors[`${prefix}Telefone` as keyof FormErrors])}
        />
        <FieldError id={`${idTel}-err`} msg={errors[`${prefix}Telefone` as keyof FormErrors]} />
      </div>

      <div>
        <FieldLabel htmlFor={idCpf}>CPF</FieldLabel>
        <input
          id={idCpf}
          name={idCpf}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          data-testid={`input-${idCpf}`}
          value={value.cpf}
          onChange={(e) => onChange({ ...value, cpf: maskCpfInput(e.target.value) })}
          onBlur={() => onBlur("cpf")}
          aria-invalid={!!errors[`${prefix}Cpf` as keyof FormErrors]}
          aria-describedby={errors[`${prefix}Cpf` as keyof FormErrors] ? `${idCpf}-err` : undefined}
          style={inputStyle(!!errors[`${prefix}Cpf` as keyof FormErrors])}
        />
        <FieldError id={`${idCpf}-err`} msg={errors[`${prefix}Cpf` as keyof FormErrors]} />
      </div>

      <div style={{ gridColumn: "1 / -1" }}>
        <FieldLabel htmlFor={idCidade}>Cidade</FieldLabel>
        <select
          id={idCidade}
          name={idCidade}
          data-testid={`input-${idCidade}`}
          value={value.cidade}
          onChange={(e) => onChange({ ...value, cidade: e.target.value })}
          onBlur={() => onBlur("cidade")}
          aria-invalid={!!errors[`${prefix}Cidade` as keyof FormErrors]}
          aria-describedby={errors[`${prefix}Cidade` as keyof FormErrors] ? `${idCidade}-err` : undefined}
          style={{
            ...inputStyle(!!errors[`${prefix}Cidade` as keyof FormErrors]),
            appearance: "none",
            background:
              `#FFFFFF url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234A4F61' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>") no-repeat right 14px center/16px 16px`,
            paddingRight: 38,
          }}
        >
          <option value="">Selecione a cidade</option>
          {cityOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <FieldError id={`${idCidade}-err`} msg={errors[`${prefix}Cidade` as keyof FormErrors]} />
      </div>
    </div>
  );
}

function ReferralForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>({
    indicador: { ...EMPTY_PERSON },
    amigo: { ...EMPTY_PERSON },
    accept: false,
    website: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState<string>("");
  const tokenFetchedRef = useRef(false);

  useEffect(() => {
    if (tokenFetchedRef.current) return;
    tokenFetchedRef.current = true;
    fetch(`${API_BASE}/api/referrals/token`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { token: string }) => {
        if (data && typeof data.token === "string") setToken(data.token);
      })
      .catch(() => {
        // ignore — submit will surface error
      });
  }, []);

  const handlePersonChange = (
    prefix: "indicador" | "amigo",
    next: Person,
  ) => {
    setForm((s) => ({ ...s, [prefix]: next }));
  };

  const handleBlur = (
    prefix: "indicador" | "amigo",
    field: keyof Person,
  ) => {
    const personErrs = validatePerson(form[prefix], prefix);
    const key = `${prefix}${field.charAt(0).toUpperCase()}${field.slice(1)}` as keyof FormErrors;
    setErrors((e) => ({ ...e, [key]: personErrs[key] }));
  };

  const goToStep2 = () => {
    const errs = validatePerson(form.indicador, "indicador");
    setErrors((prev) => ({ ...prev, ...errs }));
    if (nonNull(errs)) {
      // Scroll to first error
      const firstKey = (Object.keys(errs) as (keyof FormErrors)[]).find(
        (k) => errs[k],
      );
      if (firstKey) {
        const sel = `[data-testid="input-indicador-${firstKey.replace("indicador", "").toLowerCase()}"]`;
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el) el.focus();
      }
      return;
    }
    setStep(2);
    requestAnimationFrame(() => {
      const el = document.getElementById("referral-form-card");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const allErrs: FormErrors = {
      ...validatePerson(form.indicador, "indicador"),
      ...validatePerson(form.amigo, "amigo"),
    };
    if (!form.accept) {
      allErrs.accept = "Você precisa concordar com o regulamento.";
    }
    if (
      form.indicador.cpf.replace(/\D/g, "") &&
      form.amigo.cpf.replace(/\D/g, "") &&
      form.indicador.cpf.replace(/\D/g, "") === form.amigo.cpf.replace(/\D/g, "")
    ) {
      allErrs.amigoCpf = "O CPF do amigo deve ser diferente do seu.";
    }
    setErrors(allErrs);
    if (nonNull(allErrs)) return;

    setSubmitting(true);
    try {
      let activeToken = token;
      if (!activeToken) {
        try {
          const tokRes = await fetch(`${API_BASE}/api/referrals/token`);
          if (tokRes.ok) {
            const tokData = (await tokRes.json()) as { token?: string };
            if (tokData.token) {
              activeToken = tokData.token;
              setToken(tokData.token);
              await new Promise((r) => setTimeout(r, 2200));
            }
          }
        } catch {
          // fall through; server will reject
        }
      }
      const res = await fetch(`${API_BASE}/api/referrals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          indicadorNome: form.indicador.nome,
          indicadorTelefone: form.indicador.telefone,
          indicadorCidade: form.indicador.cidade,
          indicadorCpf: form.indicador.cpf,
          amigoNome: form.amigo.nome,
          amigoTelefone: form.amigo.telefone,
          amigoCidade: form.amigo.cidade,
          amigoCpf: form.amigo.cpf,
          website: form.website,
          _t: activeToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (Array.isArray(data?.errors)) {
          const next: FormErrors = {};
          for (const item of data.errors as Array<{
            field: string;
            message: string;
          }>) {
            next[item.field as keyof FormErrors] = item.message;
          }
          setErrors((e) => ({ ...e, ...next }));
        } else {
          setErrors((e) => ({
            ...e,
            general:
              typeof data?.error === "string"
                ? data.error
                : "Não foi possível enviar agora. Tente novamente.",
          }));
        }
        return;
      }
      setSuccess(true);
      requestAnimationFrame(() => {
        const el = document.getElementById("referral-form-card");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch {
      setErrors((e) => ({
        ...e,
        general: "Falha de conexão. Verifique sua internet e tente novamente.",
      }));
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div
        id="referral-form-card"
        data-testid="referral-form-success"
        style={{
          background: "#FFFFFF",
          borderRadius: 20,
          padding: 32,
          boxShadow: "0 18px 40px -20px rgba(18, 42, 213, 0.35)",
          border: `1px solid ${COLOR_BORDER}`,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 9999,
              background: "rgba(149, 235, 29, 0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CheckCircle2 size={36} color={COLOR_PRIMARY} aria-hidden />
          </div>
          <h3
            style={{
              fontFamily: FONT_MONTSERRAT,
              fontWeight: 800,
              fontSize: 22,
              lineHeight: "28px",
              color: COLOR_HEADING,
              margin: 0,
            }}
          >
            Indicação enviada com sucesso!
          </h3>
          <p
            style={{
              fontFamily: FONT_NUNITO,
              fontSize: 15,
              lineHeight: "22px",
              color: COLOR_SUBTLE,
              margin: 0,
              maxWidth: 420,
            }}
          >
            Nosso time comercial vai entrar em contato com seu amigo em breve.
            Quando ele assinar, você recebe seu mês grátis. 🎉
          </p>
          <button
            type="button"
            data-testid="button-new-referral"
            onClick={() => {
              setForm({
                indicador: { ...EMPTY_PERSON },
                amigo: { ...EMPTY_PERSON },
                accept: false,
                website: "",
              });
              setErrors({});
              setStep(1);
              setSuccess(false);
            }}
            style={{
              marginTop: 8,
              height: 44,
              paddingLeft: 24,
              paddingRight: 24,
              borderRadius: 10,
              background: COLOR_GREEN,
              color: COLOR_GREEN_TEXT,
              border: "none",
              cursor: "pointer",
              fontFamily: FONT_NUNITO,
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            Indicar outro amigo
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      id="referral-form-card"
      onSubmit={handleSubmit}
      noValidate
      data-testid="referral-form"
      style={{
        background: "#FFFFFF",
        borderRadius: 20,
        padding: 28,
        boxShadow: "0 18px 40px -20px rgba(18, 42, 213, 0.35)",
        border: `1px solid ${COLOR_BORDER}`,
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      {/* Honeypot — invisible to humans */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-10000px",
          top: "auto",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      >
        <label>
          Não preencher
          <input
            tabIndex={-1}
            autoComplete="off"
            type="text"
            value={form.website}
            onChange={(e) => setForm((s) => ({ ...s, website: e.target.value }))}
          />
        </label>
      </div>

      {/* Step indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {[1, 2].map((n) => {
          const active = step === n;
          const done = step > n;
          return (
            <div
              key={n}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: active || done ? 1 : 0.55,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9999,
                  background: active || done ? COLOR_PRIMARY : "#EEF0F7",
                  color: active || done ? "#FFFFFF" : COLOR_SUBTLE,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: FONT_NUNITO,
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                {done ? <CheckCircle2 size={16} /> : n}
              </div>
              <span
                style={{
                  fontFamily: FONT_NUNITO,
                  fontSize: 13,
                  fontWeight: 700,
                  color: active || done ? COLOR_PRIMARY : COLOR_SUBTLE,
                }}
              >
                {n === 1 ? "Seus dados" : "Dados do amigo"}
              </span>
              {n === 1 && (
                <span
                  aria-hidden
                  style={{
                    width: 16,
                    height: 1,
                    background: COLOR_BORDER,
                    marginLeft: 4,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <div data-testid="step-1">
          <h3
            style={{
              fontFamily: FONT_MONTSERRAT,
              fontWeight: 800,
              fontSize: 18,
              lineHeight: "24px",
              color: COLOR_HEADING,
              margin: "0 0 4px",
            }}
          >
            Quem está indicando?
          </h3>
          <p
            style={{
              fontFamily: FONT_NUNITO,
              fontSize: 13,
              lineHeight: "18px",
              color: COLOR_SUBTLE,
              margin: "0 0 18px",
            }}
          >
            Confirme seus dados de assinante para receber o seu mês grátis.
          </p>
          <PersonFields
            prefix="indicador"
            value={form.indicador}
            errors={errors}
            onChange={(p) => handlePersonChange("indicador", p)}
            onBlur={(f) => handleBlur("indicador", f)}
          />
          <button
            type="button"
            data-testid="button-step-next"
            onClick={goToStep2}
            style={{
              marginTop: 22,
              width: "100%",
              height: 48,
              borderRadius: 12,
              border: "none",
              background: COLOR_GREEN,
              color: COLOR_GREEN_TEXT,
              fontFamily: FONT_NUNITO,
              fontWeight: 800,
              fontSize: 15,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            Continuar <ArrowRight size={18} />
          </button>
        </div>
      )}

      {step === 2 && (
        <div data-testid="step-2">
          <h3
            style={{
              fontFamily: FONT_MONTSERRAT,
              fontWeight: 800,
              fontSize: 18,
              lineHeight: "24px",
              color: COLOR_HEADING,
              margin: "0 0 4px",
            }}
          >
            Quem você está indicando?
          </h3>
          <p
            style={{
              fontFamily: FONT_NUNITO,
              fontSize: 13,
              lineHeight: "18px",
              color: COLOR_SUBTLE,
              margin: "0 0 18px",
            }}
          >
            Conte para nós os dados do seu amigo. Vamos falar com ele com todo
            cuidado.
          </p>
          <PersonFields
            prefix="amigo"
            value={form.amigo}
            errors={errors}
            onChange={(p) => handlePersonChange("amigo", p)}
            onBlur={(f) => handleBlur("amigo", f)}
          />

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              marginTop: 18,
              fontFamily: FONT_NUNITO,
              fontSize: 13,
              lineHeight: "18px",
              color: COLOR_SUBTLE,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              data-testid="input-accept"
              checked={form.accept}
              onChange={(e) =>
                setForm((s) => ({ ...s, accept: e.target.checked }))
              }
              style={{
                width: 18,
                height: 18,
                marginTop: 2,
                accentColor: COLOR_PRIMARY,
                flexShrink: 0,
              }}
            />
            <span>
              Confirmo que conversei com meu amigo e ele autorizou o contato da
              equipe Provider + Fibra. Concordo com o regulamento da campanha.
            </span>
          </label>
          <FieldError msg={errors.accept} />

          {errors.general && (
            <div
              role="alert"
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 10,
                background: "rgba(208,41,41,0.08)",
                color: COLOR_ERROR,
                fontFamily: FONT_NUNITO,
                fontWeight: 600,
                fontSize: 13,
                lineHeight: "18px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <AlertCircle size={16} aria-hidden />
              <span>{errors.general}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            <button
              type="button"
              data-testid="button-step-back"
              onClick={() => setStep(1)}
              style={{
                height: 48,
                paddingLeft: 18,
                paddingRight: 18,
                borderRadius: 12,
                border: `1px solid ${COLOR_BORDER}`,
                background: "#FFFFFF",
                color: COLOR_PRIMARY,
                fontFamily: FONT_NUNITO,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <ArrowLeft size={16} /> Voltar
            </button>
            <button
              type="submit"
              data-testid="button-submit"
              disabled={submitting}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 12,
                border: "none",
                background: COLOR_GREEN,
                color: COLOR_GREEN_TEXT,
                fontFamily: FONT_NUNITO,
                fontWeight: 800,
                fontSize: 15,
                cursor: submitting ? "wait" : "pointer",
                opacity: submitting ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {submitting ? (
                "Enviando…"
              ) : (
                <>
                  Enviar indicação <Send size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function ReferralHero() {
  return (
    <section
      data-testid="referral-hero"
      style={{
        background: `linear-gradient(135deg, ${COLOR_PRIMARY} 0%, ${COLOR_PRIMARY_LIGHT} 60%, #2546E0 100%)`,
        paddingTop: 140,
        paddingBottom: 64,
        color: "#FFFFFF",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 85% 15%, rgba(149,235,29,0.18), transparent 45%), radial-gradient(circle at 10% 90%, rgba(255,255,255,0.10), transparent 40%)",
          pointerEvents: "none",
        }}
      />
      <div
        className="mx-auto px-6 lg:px-0"
        style={{
          maxWidth: 1100,
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1.05fr 1fr",
          gap: 48,
          alignItems: "center",
        }}
      >
        <div>
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(149,235,29,0.18)",
              color: COLOR_GREEN,
              fontFamily: FONT_NUNITO,
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "8px 14px",
              borderRadius: 9999,
              marginBottom: 18,
            }}
          >
            <Sparkles size={14} aria-hidden /> Programa de indicação
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            style={{
              fontFamily: FONT_MONTSERRAT,
              fontWeight: 800,
              fontSize: 44,
              lineHeight: "52px",
              margin: "0 0 16px",
              letterSpacing: "-0.5px",
            }}
          >
            Indique um amigo e{" "}
            <span style={{ color: COLOR_GREEN }}>ganhe 1 mês grátis</span> de
            internet
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            style={{
              fontFamily: FONT_NUNITO,
              fontWeight: 500,
              fontSize: 17,
              lineHeight: "26px",
              color: "rgba(255,255,255,0.9)",
              margin: 0,
              maxWidth: 520,
            }}
          >
            Compartilhe a melhor fibra do Oeste da Bahia com quem você gosta. A
            cada amigo que assinar pela sua indicação, você ganha 1 mês de
            mensalidade grátis. Sem limite de indicações.
          </motion.p>

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "26px 0 0",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              maxWidth: 520,
            }}
          >
            {[
              "1 mês grátis por indicação",
              "Sem limite de amigos",
              "Crédito direto na fatura",
              "Atendimento humano",
            ].map((b) => (
              <li
                key={b}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: FONT_NUNITO,
                  fontWeight: 600,
                  fontSize: 14,
                  color: "rgba(255,255,255,0.95)",
                }}
              >
                <CheckCircle2 size={18} color={COLOR_GREEN} aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="referral-hero-art"
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              width: 360,
              height: 360,
              borderRadius: 9999,
              background:
                "radial-gradient(circle, rgba(149,235,29,0.28) 0%, transparent 70%)",
              filter: "blur(8px)",
            }}
          />
          <img
            src={friendsImage}
            alt="Amigos celebrando juntos"
            loading="eager"
            decoding="async"
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 440,
              height: "auto",
              borderRadius: 20,
              objectFit: "cover",
            }}
          />
        </motion.div>
      </div>
    </section>
  );
}

function ReferralRulesBanner() {
  return (
    <section
      data-testid="referral-rules"
      style={{
        background: "#FFFFFF",
        paddingTop: 36,
        paddingBottom: 36,
      }}
    >
      <div
        className="mx-auto px-6 lg:px-0"
        style={{
          maxWidth: 1100,
          display: "flex",
          gap: 18,
          alignItems: "center",
          background:
            "linear-gradient(90deg, rgba(149,235,29,0.16) 0%, rgba(18,42,213,0.06) 100%)",
          border: `1px solid ${COLOR_BORDER}`,
          borderRadius: 16,
          padding: "20px 24px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: COLOR_GREEN,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: COLOR_GREEN_TEXT,
            flexShrink: 0,
          }}
        >
          <Gift size={24} aria-hidden />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3
            style={{
              fontFamily: FONT_MONTSERRAT,
              fontWeight: 800,
              fontSize: 18,
              lineHeight: "24px",
              color: COLOR_HEADING,
              margin: "0 0 4px",
            }}
          >
            Como funciona o seu mês grátis?
          </h3>
          <p
            style={{
              fontFamily: FONT_NUNITO,
              fontSize: 14,
              lineHeight: "20px",
              color: COLOR_SUBTLE,
              margin: 0,
            }}
          >
            Quando seu amigo assinar e a instalação for concluída, aplicamos um
            crédito equivalente a 1 mensalidade do seu plano na sua próxima
            fatura.
          </p>
        </div>
      </div>
    </section>
  );
}

function ReferralHowItWorks() {
  const steps = [
    {
      icon: <Users size={26} />,
      title: "1. Você indica",
      text: "Preencha o formulário com seus dados de assinante e os do seu amigo.",
    },
    {
      icon: <Wifi size={26} />,
      title: "2. Seu amigo assina",
      text: "Nosso time entra em contato, monta o melhor plano e faz a instalação grátis.",
    },
    {
      icon: <Gift size={26} />,
      title: "3. Você ganha 1 mês grátis",
      text: "Aplicamos o crédito da sua mensalidade na sua próxima fatura. Pronto!",
    },
  ];
  return (
    <section
      data-testid="referral-how-it-works"
      style={{
        background: "#FBFBFD",
        paddingTop: 60,
        paddingBottom: 60,
      }}
    >
      <div
        className="mx-auto px-6 lg:px-0"
        style={{ maxWidth: 1100, display: "flex", flexDirection: "column", gap: 30 }}
      >
        <div style={{ textAlign: "center" }}>
          <h2
            style={{
              fontFamily: FONT_MONTSERRAT,
              fontWeight: 400,
              fontSize: 32,
              lineHeight: "40px",
              color: COLOR_HEADING,
              margin: 0,
            }}
          >
            Como funciona em <span style={{ fontWeight: 800 }}>3 passos</span>
          </h2>
          <p
            style={{
              fontFamily: FONT_NUNITO,
              fontWeight: 400,
              fontSize: 16,
              lineHeight: "24px",
              color: COLOR_SUBTLE,
              margin: "8px 0 0",
            }}
          >
            Simples, rápido e sem complicação
          </p>
        </div>
        <div
          className="referral-steps"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 18,
          }}
        >
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              style={{
                background: "#FFFFFF",
                border: `1px solid ${COLOR_BORDER}`,
                borderRadius: 18,
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: "rgba(18,42,213,0.08)",
                  color: COLOR_PRIMARY,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {s.icon}
              </div>
              <h3
                style={{
                  fontFamily: FONT_MONTSERRAT,
                  fontWeight: 800,
                  fontSize: 17,
                  lineHeight: "24px",
                  color: COLOR_HEADING,
                  margin: 0,
                }}
              >
                {s.title}
              </h3>
              <p
                style={{
                  fontFamily: FONT_NUNITO,
                  fontWeight: 500,
                  fontSize: 14,
                  lineHeight: "20px",
                  color: COLOR_SUBTLE,
                  margin: 0,
                }}
              >
                {s.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReferralIfYouWereInvited() {
  return (
    <section
      data-testid="referral-invited"
      style={{
        background: COLOR_PRIMARY_DARK,
        paddingTop: 56,
        paddingBottom: 56,
        color: "#FFFFFF",
      }}
    >
      <div
        className="mx-auto px-6 lg:px-0"
        style={{
          maxWidth: 920,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          alignItems: "center",
        }}
      >
        <h2
          style={{
            fontFamily: FONT_MONTSERRAT,
            fontWeight: 800,
            fontSize: 28,
            lineHeight: "36px",
            margin: 0,
          }}
        >
          Foi você quem foi indicado?
        </h2>
        <p
          style={{
            fontFamily: FONT_NUNITO,
            fontSize: 16,
            lineHeight: "24px",
            color: "rgba(255,255,255,0.85)",
            margin: 0,
            maxWidth: 600,
          }}
        >
          Que ótimo! Fale com o nosso time pelo WhatsApp e diga o nome do
          amigo que indicou. A gente cuida de tudo: escolha do plano,
          instalação grátis e ainda garante o mês grátis para quem te indicou.
        </p>
        <a
          href="https://wa.me/5577998444757?text=Ol%C3%A1!%20Fui%20indicado%20por%20um%20amigo%20e%20quero%20assinar%20o%20Provider%20+%20Fibra."
          target="_blank"
          rel="noopener noreferrer"
          data-testid="invited-cta"
          style={{
            marginTop: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            background: COLOR_GREEN,
            color: COLOR_GREEN_TEXT,
            padding: "14px 26px",
            borderRadius: 9999,
            fontFamily: FONT_NUNITO,
            fontWeight: 800,
            fontSize: 15,
            textDecoration: "none",
          }}
        >
          Falar com o time agora <ArrowRight size={18} />
        </a>
      </div>
    </section>
  );
}

export default function IndiqueUmAmigo() {
  const seoSchemas = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Início",
            item: "https://providerfibra.com.br/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Indique um amigo",
            item: "https://providerfibra.com.br/indique-um-amigo",
          },
        ],
      },
    ],
    [],
  );

  return (
    <>
      <SEO
        title="Indique um amigo e ganhe 1 mês grátis"
        description="Indique um amigo para a Provider + Fibra e ganhe 1 mês de internet grátis a cada amigo que assinar. Sem limite de indicações no Oeste da Bahia."
        path="/indique-um-amigo"
        jsonLd={seoSchemas}
      />
      <Header />
      <main id="main-content">
        <ReferralHero />
        <section
          data-testid="referral-form-section"
          style={{
            background: "#FFFFFF",
            paddingTop: 48,
            paddingBottom: 24,
          }}
        >
          <div
            className="mx-auto px-6 lg:px-0"
            style={{ maxWidth: 720 }}
          >
            <ReferralForm />
          </div>
        </section>
        <ReferralRulesBanner />
        <ReferralHowItWorks />
        <ReferralIfYouWereInvited />
      </main>
      <Footer />
      <WhatsAppFloat />

      <style>{`
        @media (max-width: 899px) {
          [data-testid="referral-hero"] > div {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
            padding-top: 0 !important;
          }
          [data-testid="referral-hero"] h1 {
            font-size: 32px !important;
            line-height: 38px !important;
          }
          .referral-steps {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 599px) {
          .referral-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}
