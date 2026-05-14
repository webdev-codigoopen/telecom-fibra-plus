import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Users,
  Wifi,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Send,
  Phone,
  MessageCircle,
  UserPlus,
  ChevronDown,
} from "lucide-react";
import SEO from "@/components/SEO";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import WhatsAppFloat from "@/components/sections/WhatsAppFloat";
import friendsImage from "@assets/amigos_1778782009998.png";
import heroBackgroundImage from "@assets/ChatGPT_Image_14_de_mai._de_2026,_11_40_54_1778782002221.png";
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
const COLOR_GREEN = "#95EB1D";
const COLOR_GREEN_TEXT = "#2A40DA";
const COLOR_TEXT = "#0D0E14";
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

const SR_ONLY: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};

const FieldLabel = ({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) => (
  <label htmlFor={htmlFor} style={SR_ONLY}>
    {children}
  </label>
);

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: "100%",
  height: 48,
  paddingLeft: 18,
  paddingRight: 18,
  borderRadius: 9999,
  border: `1px solid ${hasError ? COLOR_ERROR : "rgba(255,255,255,0.35)"}`,
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
  const isAmigo = prefix === "amigo";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 14,
      }}
      className="referral-grid"
    >
      <div>
        <FieldLabel htmlFor={idNome}>{isAmigo ? "Nome do amigo" : "Seu nome"}</FieldLabel>
        <input
          id={idNome}
          name={idNome}
          type="text"
          autoComplete="name"
          placeholder={isAmigo ? "Nome do amigo" : "Seu nome"}
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
        <FieldLabel htmlFor={idTel}>{isAmigo ? "Telefone do amigo" : "Seu telefone"}</FieldLabel>
        <input
          id={idTel}
          name={idTel}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={isAmigo ? "Telefone do amigo" : "Seu telefone"}
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
              `#FFFFFF url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234A4F61' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>") no-repeat right 18px center/16px 16px`,
            paddingRight: 42,
            color: value.cidade ? COLOR_TEXT : "#9097A8",
          }}
        >
          <option value="">Cidade</option>
          {cityOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <FieldError id={`${idCidade}-err`} msg={errors[`${prefix}Cidade` as keyof FormErrors]} />
      </div>

      <div>
        <FieldLabel htmlFor={idCpf}>CPF</FieldLabel>
        <input
          id={idCpf}
          name={idCpf}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="CPF"
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

  const cardStyle: React.CSSProperties = {
    background: "rgba(58, 91, 230, 0.55)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 24,
    padding: "36px 40px",
    boxShadow: "0 28px 60px -28px rgba(0,0,0,0.45)",
    display: "flex",
    flexDirection: "column",
    gap: 22,
    color: "#FFFFFF",
  };

  if (success) {
    return (
      <div
        id="referral-form-card"
        data-testid="referral-form-success"
        style={{ ...cardStyle, alignItems: "center", textAlign: "center" }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 9999,
            background: "rgba(149, 235, 29, 0.20)",
            border: "1px solid rgba(149, 235, 29, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckCircle2 size={32} color={COLOR_GREEN} aria-hidden />
        </div>
        <h3
          style={{
            fontFamily: FONT_MONTSERRAT,
            fontWeight: 800,
            fontSize: 22,
            lineHeight: "28px",
            color: "#FFFFFF",
            margin: 0,
          }}
        >
          Indicação enviada com sucesso!
        </h3>
        <p
          style={{
            fontFamily: FONT_NUNITO,
            fontSize: 14,
            lineHeight: "22px",
            color: "rgba(255,255,255,0.85)",
            margin: 0,
            maxWidth: 420,
          }}
        >
          Nosso time comercial vai entrar em contato com seu amigo em breve.
          Quando ele assinar e instalar, você ganha 50% de desconto na sua
          próxima mensalidade.
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
            marginTop: 4,
            height: 48,
            paddingLeft: 28,
            paddingRight: 28,
            borderRadius: 9999,
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
    );
  }

  return (
    <form
      id="referral-form-card"
      onSubmit={handleSubmit}
      noValidate
      data-testid="referral-form"
      style={cardStyle}
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

      <div style={{ textAlign: "center" }}>
        <h3
          style={{
            fontFamily: FONT_MONTSERRAT,
            fontWeight: 800,
            fontSize: 26,
            lineHeight: "32px",
            color: "#FFFFFF",
            margin: 0,
          }}
        >
          Para conseguir o desconto é simples
        </h3>
        <p
          style={{
            fontFamily: FONT_NUNITO,
            fontWeight: 500,
            fontSize: 14,
            lineHeight: "20px",
            color: "rgba(255,255,255,0.85)",
            margin: "8px 0 0",
          }}
        >
          {step === 1
            ? "Primeiro precisamos dos seus dados de assinante, por favor :)"
            : "Agora nos diga os dados do seu amigo. Vamos falar com ele com todo cuidado."}
        </p>
      </div>

      {/* Step indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: 0,
          marginTop: 4,
        }}
      >
        {[1, 2].map((n) => {
          const active = step === n;
          const done = step > n;
          const isOn = active || done;
          return (
            <div
              key={n}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  minWidth: 140,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9999,
                    background: isOn ? COLOR_GREEN : "rgba(255,255,255,0.18)",
                    color: isOn ? COLOR_GREEN_TEXT : "#FFFFFF",
                    border: isOn
                      ? "none"
                      : "1px solid rgba(255,255,255,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: FONT_NUNITO,
                    fontWeight: 800,
                    fontSize: 14,
                  }}
                >
                  {done ? <CheckCircle2 size={18} /> : n}
                </div>
                <span
                  style={{
                    fontFamily: FONT_NUNITO,
                    fontSize: 12,
                    fontWeight: 600,
                    color: isOn ? "#FFFFFF" : "rgba(255,255,255,0.7)",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  {n === 1 ? "Informe seus dados" : "Dados do seu amigo"}
                </span>
              </div>
              {n === 1 && (
                <span
                  aria-hidden
                  style={{
                    width: 40,
                    height: 1,
                    background: "rgba(255,255,255,0.35)",
                    marginTop: 16,
                    marginLeft: 8,
                    marginRight: 8,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <div data-testid="step-1" style={{ marginTop: 4 }}>
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
              height: 52,
              borderRadius: 9999,
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
            Próxima etapa <ArrowRight size={18} />
          </button>
        </div>
      )}

      {step === 2 && (
        <div data-testid="step-2" style={{ marginTop: 4 }}>
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
              fontSize: 12,
              lineHeight: "18px",
              color: "rgba(255,255,255,0.85)",
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
                marginTop: 1,
                accentColor: COLOR_GREEN,
                flexShrink: 0,
              }}
            />
            <span>
              Confirmo que conversei com meu amigo e ele autorizou o contato
              da equipe Provider + Fibra. Concordo com o regulamento da
              campanha.
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
                background: "rgba(208,41,41,0.18)",
                color: "#FFFFFF",
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
                height: 52,
                paddingLeft: 22,
                paddingRight: 22,
                borderRadius: 9999,
                border: "1px solid rgba(255,255,255,0.4)",
                background: "transparent",
                color: "#FFFFFF",
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
                height: 52,
                borderRadius: 9999,
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
        background: COLOR_PRIMARY,
        paddingTop: 80,
        paddingBottom: 200,
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
          backgroundImage: `url(${heroBackgroundImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.45,
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, rgba(18,42,213,0.55) 0%, rgba(18,42,213,0.85) 75%, ${COLOR_PRIMARY} 100%)`,
          pointerEvents: "none",
        }}
      />
      <div
        className="mx-auto px-6 lg:px-0 referral-hero-grid"
        style={{
          maxWidth: 1100,
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          gap: 40,
          alignItems: "center",
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <img
            src={friendsImage}
            alt="Amigos celebrando juntos"
            loading="eager"
            decoding="async"
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 520,
              height: "auto",
            }}
          />
        </motion.div>
        <div style={{ textAlign: "center" }}>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            style={{
              fontFamily: FONT_MONTSERRAT,
              fontWeight: 700,
              fontSize: 36,
              lineHeight: "44px",
              margin: "0 0 16px",
              letterSpacing: "-0.3px",
            }}
          >
            Indique um amigo e{" "}
            <span style={{ color: COLOR_GREEN, fontWeight: 800 }}>
              ganhe 50%
            </span>{" "}
            de desconto na sua mensalidade
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            style={{
              fontFamily: FONT_NUNITO,
              fontWeight: 500,
              fontSize: 14,
              lineHeight: "22px",
              color: "rgba(255,255,255,0.85)",
              margin: "0 auto",
              maxWidth: 360,
            }}
          >
            Compartilhe seu link de indicação com um amigo. Quando ele assinar,
            você recebe 50% de desconto na sua próxima mensalidade. Aproveite
            para economizar e curtir ainda mais conteúdo.
          </motion.p>
        </div>
      </div>
    </section>
  );
}

function ReferralRulesBanner() {
  return (
    <section
      data-testid="referral-rules"
      style={{
        background: COLOR_GREEN,
        paddingTop: 18,
        paddingBottom: 18,
      }}
    >
      <div
        className="mx-auto px-6 lg:px-0"
        style={{
          maxWidth: 1100,
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: FONT_NUNITO,
            fontWeight: 700,
            fontSize: 13,
            lineHeight: "20px",
            color: COLOR_GREEN_TEXT,
            margin: 0,
          }}
        >
          Indicações são válidas somente para clientes vigentes. O programa de
          indicação é válido em todo o território de atuação do Provider +
          Fibra. Consulte as condições e o regulamento no canal de
          atendimento.
        </p>
      </div>
    </section>
  );
}

function ReferralHowItWorks() {
  const steps = [
    {
      icon: <Users size={26} />,
      title: "Você indica um amigo.",
      text: "Você pode trazer seus amigos para a melhor internet e ainda ganhar desconto.",
    },
    {
      icon: <Phone size={26} />,
      title: "Nós entramos em contato.",
      text: "Nessa parte nós ligamos para os seus indicados para confirmar a sua indicação.",
    },
    {
      icon: <CheckCircle2 size={26} />,
      title: "Se seu amigo assinar.",
      text: "Caso o seu amigo contratar um plano da Provider + Fibra.",
    },
    {
      icon: <Wifi size={26} />,
      title: "Se seu amigo instalar.",
      text: "Você ganha um super desconto de 50% na sua próxima mensalidade.",
    },
  ];
  return (
    <section
      data-testid="referral-how-it-works"
      style={{
        background: COLOR_PRIMARY,
        paddingTop: 70,
        paddingBottom: 60,
        color: "#FFFFFF",
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
              fontWeight: 700,
              fontSize: 30,
              lineHeight: "38px",
              color: "#FFFFFF",
              margin: 0,
            }}
          >
            Veja como é fácil{" "}
            <span style={{ fontWeight: 800, color: COLOR_GREEN }}>
              participar
            </span>
          </h2>
        </div>
        <div
          className="referral-steps"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
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
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 14,
                padding: "22px 20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 9999,
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.22)",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: -42,
                  boxShadow: "0 6px 18px -8px rgba(0,0,0,0.35)",
                }}
              >
                {s.icon}
              </div>
              <h3
                style={{
                  fontFamily: FONT_MONTSERRAT,
                  fontWeight: 800,
                  fontSize: 16,
                  lineHeight: "22px",
                  color: "#FFFFFF",
                  margin: 0,
                }}
              >
                {s.title}
              </h3>
              <p
                style={{
                  fontFamily: FONT_NUNITO,
                  fontWeight: 500,
                  fontSize: 13,
                  lineHeight: "19px",
                  color: "rgba(255,255,255,0.78)",
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
  const cards: Array<{
    icon: React.ReactNode;
    title: string;
    text: string;
  }> = [
    {
      icon: <MessageCircle size={26} />,
      title: "Você receberá um link no WhatsApp",
      text: "Após receber o link confirme a sua participação na promoção.",
    },
    {
      icon: <Phone size={26} />,
      title: "Aguarde o nosso contato",
      text: "Você precisará aguardar nosso contato para que a promoção seja válida.",
    },
    {
      icon: <UserPlus size={26} />,
      title: "Assine um plano e indique amigos",
      text: "Após assinar um dos planos você poderá indicar outros amigos.",
    },
  ];

  return (
    <section
      data-testid="referral-invited"
      style={{
        background: COLOR_PRIMARY,
        paddingTop: 30,
        paddingBottom: 60,
        color: "#FFFFFF",
      }}
    >
      <div
        className="mx-auto px-6 lg:px-0"
        style={{
          maxWidth: 1100,
          display: "flex",
          flexDirection: "column",
          gap: 30,
        }}
      >
        <div style={{ textAlign: "left" }}>
          <h2
            style={{
              fontFamily: FONT_MONTSERRAT,
              fontWeight: 700,
              fontSize: 28,
              lineHeight: "36px",
              margin: 0,
            }}
          >
            Se você foi{" "}
            <span style={{ fontWeight: 800, color: COLOR_GREEN }}>
              indicado
            </span>
          </h2>
        </div>
        <div
          className="referral-invited-cards"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 18,
          }}
        >
          {cards.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 14,
                padding: "22px 22px",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 9999,
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.22)",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {c.icon}
              </div>
              <h3
                style={{
                  fontFamily: FONT_MONTSERRAT,
                  fontWeight: 800,
                  fontSize: 16,
                  lineHeight: "22px",
                  margin: 0,
                }}
              >
                {c.title}
              </h3>
              <p
                style={{
                  fontFamily: FONT_NUNITO,
                  fontWeight: 500,
                  fontSize: 13,
                  lineHeight: "19px",
                  color: "rgba(255,255,255,0.78)",
                  margin: 0,
                  flex: 1,
                }}
              >
                {c.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReferralFAQ() {
  const items = [
    {
      q: "Quem pode indicar amigos?",
      a: "Qualquer cliente Provider + Fibra com plano vigente (mensalidade em dia) pode indicar amigos pelo programa.",
    },
    {
      q: "Quando o desconto de 50% entra na minha fatura?",
      a: "Assim que seu amigo assinar e a instalação for concluída, aplicamos o desconto na sua próxima mensalidade.",
    },
    {
      q: "Existe limite de indicações?",
      a: "Não. Você pode indicar quantos amigos quiser — a cada indicação que virar instalação, você ganha 50% de desconto na sua mensalidade seguinte.",
    },
    {
      q: "Como meu amigo precisa entrar em contato?",
      a: "Não precisa. Após você preencher o formulário, nosso time comercial entra em contato com o seu amigo pelo WhatsApp para apresentar o melhor plano.",
    },
    {
      q: "O que acontece depois que eu envio uma indicação?",
      a: "Você recebe a confirmação no formulário, nosso time fala com o seu amigo, monta o plano ideal e agenda a instalação grátis. Quando a instalação for concluída, o desconto é lançado na sua fatura.",
    },
    {
      q: "O programa vale em quais cidades?",
      a: "O programa é válido em todo o território de atuação do Provider + Fibra no Oeste da Bahia. Consulte as condições e o regulamento no canal de atendimento.",
    },
  ];
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section
      data-testid="referral-faq"
      style={{
        background: COLOR_PRIMARY,
        paddingTop: 50,
        paddingBottom: 80,
        color: "#FFFFFF",
      }}
    >
      <div
        className="mx-auto px-6 lg:px-0"
        style={{
          maxWidth: 920,
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h2
            style={{
              fontFamily: FONT_MONTSERRAT,
              fontWeight: 700,
              fontSize: 30,
              lineHeight: "38px",
              color: "#FFFFFF",
              margin: 0,
            }}
          >
            Ficou com alguma{" "}
            <span style={{ fontWeight: 800, color: COLOR_GREEN }}>
              dúvida?
            </span>
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((it, i) => {
            const open = openIdx === i;
            return (
              <div
                key={it.q}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : i)}
                  aria-expanded={open}
                  data-testid={`faq-toggle-${i}`}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "16px 22px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: FONT_NUNITO,
                    fontWeight: 600,
                    fontSize: 14,
                    lineHeight: "20px",
                    color: "#FFFFFF",
                  }}
                >
                  <span>{it.q}</span>
                  <ChevronDown
                    size={18}
                    aria-hidden
                    style={{
                      transition: "transform 0.2s ease",
                      transform: open ? "rotate(180deg)" : "rotate(0deg)",
                      flexShrink: 0,
                      color: "#FFFFFF",
                      opacity: 0.8,
                    }}
                  />
                </button>
                {open && (
                  <div
                    style={{
                      padding: "0 22px 18px",
                      fontFamily: FONT_NUNITO,
                      fontWeight: 500,
                      fontSize: 13,
                      lineHeight: "20px",
                      color: "rgba(255,255,255,0.8)",
                    }}
                  >
                    {it.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
        title="Indique um amigo e ganhe 50% de desconto"
        description="Indique um amigo para a Provider + Fibra e ganhe 50% de desconto na sua mensalidade a cada amigo que assinar e instalar. Sem limite de indicações no Oeste da Bahia."
        path="/indique-um-amigo"
        jsonLd={seoSchemas}
      />
      <Header />
      <main
        id="main-content"
        style={{ background: COLOR_PRIMARY, color: "#FFFFFF" }}
      >
        <div style={{ position: "relative" }}>
          <ReferralHero />
          <section
            data-testid="referral-form-section"
            style={{
              background: "transparent",
              marginTop: -150,
              paddingBottom: 40,
              position: "relative",
              zIndex: 2,
            }}
          >
            <div
              className="mx-auto px-6 lg:px-0"
              style={{ maxWidth: 760 }}
            >
              <ReferralForm />
            </div>
          </section>
        </div>
        <ReferralRulesBanner />
        <ReferralHowItWorks />
        <ReferralIfYouWereInvited />
        <ReferralFAQ />
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
