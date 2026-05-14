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
import heroBannerImage from "@assets/bannerindique_-_um_amigo_1778785391656.png";
import {
  maskWhatsappInput,
  sanitizeNameInput,
  validateName,
  validateWhatsapp,
} from "@/lib/contactValidation";

const BASE = import.meta.env.BASE_URL;
const API_BASE = BASE.replace(/\/$/, "");

const FONT_MONTSERRAT = "'Montserrat', system-ui, sans-serif";
const FONT_NUNITO = FONT_MONTSERRAT;

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
  height: 56,
  paddingLeft: 18,
  paddingRight: 18,
  paddingTop: 22,
  paddingBottom: 6,
  borderRadius: 12,
  border: `1px solid ${hasError ? COLOR_ERROR : "#E1E5EE"}`,
  background: "#F7F8FB",
  fontFamily: FONT_MONTSERRAT,
  fontWeight: 400,
  fontSize: 15,
  lineHeight: "20px",
  color: COLOR_TEXT,
  outline: "none",
  transition: "border-color 0.15s ease, background-color 0.15s ease",
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

function FloatingField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="referral-field">
      <label
        htmlFor={id}
        className="referral-field__label"
        style={{
          fontFamily: FONT_MONTSERRAT,
          fontWeight: 400,
          color: error ? COLOR_ERROR : "#5A6273",
        }}
      >
        {label}
      </label>
      {children}
      {error && (
        <div
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
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function PersonFields({ prefix, value, errors, onChange, onBlur }: PersonFieldsProps) {
  const idNome = `${prefix}-nome`;
  const idTel = `${prefix}-telefone`;
  const idCidade = `${prefix}-cidade`;
  const idCpf = `${prefix}-cpf`;
  const isAmigo = prefix === "amigo";
  const errNome = errors[`${prefix}Nome` as keyof FormErrors];
  const errTel = errors[`${prefix}Telefone` as keyof FormErrors];
  const errCidade = errors[`${prefix}Cidade` as keyof FormErrors];
  const errCpf = errors[`${prefix}Cpf` as keyof FormErrors];

  return (
    <div
      className="referral-grid"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}
    >
      <FloatingField id={idNome} label={isAmigo ? "Nome do amigo" : "Seu nome"} error={errNome}>
        <input
          id={idNome}
          name={idNome}
          type="text"
          autoComplete="name"
          placeholder=" "
          data-testid={`input-${idNome}`}
          value={value.nome}
          onChange={(e) => onChange({ ...value, nome: sanitizeNameInput(e.target.value) })}
          onBlur={() => onBlur("nome")}
          aria-invalid={!!errNome}
          className="referral-field__input"
          style={inputStyle(!!errNome)}
        />
      </FloatingField>

      <FloatingField id={idTel} label={isAmigo ? "Telefone do amigo" : "Seu telefone"} error={errTel}>
        <input
          id={idTel}
          name={idTel}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder=" "
          data-testid={`input-${idTel}`}
          value={value.telefone}
          onChange={(e) =>
            onChange({ ...value, telefone: maskWhatsappInput(e.target.value, value.telefone) })
          }
          onBlur={() => onBlur("telefone")}
          aria-invalid={!!errTel}
          className="referral-field__input"
          style={inputStyle(!!errTel)}
        />
      </FloatingField>

      <FloatingField id={idCidade} label="Cidade" error={errCidade}>
        <select
          id={idCidade}
          name={idCidade}
          data-testid={`input-${idCidade}`}
          value={value.cidade}
          onChange={(e) => onChange({ ...value, cidade: e.target.value })}
          onBlur={() => onBlur("cidade")}
          aria-invalid={!!errCidade}
          className="referral-field__input referral-field__input--select"
          style={{
            ...inputStyle(!!errCidade),
            appearance: "none",
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23${COLOR_PRIMARY.slice(1)}' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 16px center",
            backgroundSize: "14px 14px",
            paddingRight: 40,
            color: value.cidade ? COLOR_TEXT : "transparent",
          }}
        >
          <option value=""></option>
          {cityOptions.map((c) => (
            <option key={c} value={c} style={{ color: COLOR_TEXT }}>
              {c}
            </option>
          ))}
        </select>
      </FloatingField>

      <FloatingField id={idCpf} label="CPF" error={errCpf}>
        <input
          id={idCpf}
          name={idCpf}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder=" "
          data-testid={`input-${idCpf}`}
          value={value.cpf}
          onChange={(e) => onChange({ ...value, cpf: maskCpfInput(e.target.value) })}
          onBlur={() => onBlur("cpf")}
          aria-invalid={!!errCpf}
          className="referral-field__input"
          style={inputStyle(!!errCpf)}
        />
      </FloatingField>
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
    background: "#FFFFFF",
    borderRadius: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 32,
    color: COLOR_TEXT,
    position: "relative",
  };

  const stepLabel = step === 1 ? "Seus dados de assinante" : "Dados do seu amigo";
  const stepCaption =
    step === 1
      ? "Primeiro, confirmamos que você é cliente Provider + Fibra."
      : "Agora, nos diga quem você quer indicar — vamos falar com cuidado.";

  if (success) {
    return (
      <div
        id="referral-form-card"
        data-testid="referral-form-success"
        style={{ ...cardStyle, alignItems: "center", textAlign: "center", gap: 18 }}
      >
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 9999,
            background: "rgba(149, 235, 29, 0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckCircle2 size={34} color={COLOR_PRIMARY} aria-hidden />
        </div>
        <h3
          style={{
            fontFamily: FONT_MONTSERRAT,
            fontWeight: 800,
            fontSize: 26,
            lineHeight: "32px",
            color: COLOR_PRIMARY,
            margin: 0,
            letterSpacing: "-0.4px",
          }}
        >
          Indicação enviada
        </h3>
        <p
          style={{
            fontFamily: FONT_NUNITO,
            fontSize: 15,
            lineHeight: "24px",
            color: "#4A4F61",
            margin: 0,
            maxWidth: 440,
          }}
        >
          Nosso time vai falar com seu amigo em breve. Quando ele assinar e a
          instalação for concluída, o desconto de 50% entra na sua próxima
          mensalidade.
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
          className="referral-btn referral-btn--primary"
          style={{ marginTop: 6, paddingLeft: 32, paddingRight: 32 }}
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

      {/* Header — editorial, no chips/badges */}
      <header style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <span
            style={{
              fontFamily: FONT_NUNITO,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: COLOR_PRIMARY,
            }}
          >
            Etapa {step} de 2
          </span>
          <span
            style={{
              fontFamily: FONT_NUNITO,
              fontSize: 13,
              fontWeight: 600,
              color: "#7A8195",
            }}
          >
            {stepLabel}
          </span>
        </div>

        {/* Slim progress bar — no circles, no labels */}
        <div
          aria-hidden
          style={{
            position: "relative",
            height: 3,
            borderRadius: 999,
            background: "#EDEFF6",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: step === 1 ? "50%" : "100%",
              background: `linear-gradient(90deg, ${COLOR_PRIMARY} 0%, ${COLOR_GREEN} 100%)`,
              borderRadius: 999,
              transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>

        <h2
          style={{
            fontFamily: FONT_MONTSERRAT,
            fontWeight: 800,
            fontSize: 28,
            lineHeight: "34px",
            color: COLOR_PRIMARY,
            margin: "10px 0 0",
            letterSpacing: "-0.5px",
          }}
        >
          {step === 1 ? "Vamos começar pelos seus dados." : "Quem você quer indicar?"}
        </h2>
        <p
          style={{
            fontFamily: FONT_NUNITO,
            fontWeight: 500,
            fontSize: 15,
            lineHeight: "22px",
            color: "#4A4F61",
            margin: 0,
            maxWidth: 460,
          }}
        >
          {stepCaption}
        </p>
      </header>

      {step === 1 && (
        <div data-testid="step-1" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
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
            className="referral-btn referral-btn--primary"
            style={{ alignSelf: "center" }}
          >
            Continuar <ArrowRight size={16} />
          </button>
        </div>
      )}

      {step === 2 && (
        <div data-testid="step-2" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
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
              gap: 12,
              fontFamily: FONT_NUNITO,
              fontSize: 13,
              lineHeight: "20px",
              color: "#4A4F61",
              cursor: "pointer",
              padding: 14,
              background: "#F7F8FB",
              borderRadius: 12,
              border: "1px solid #E8EBF2",
            }}
          >
            <input
              type="checkbox"
              data-testid="input-accept"
              checked={form.accept}
              onChange={(e) => setForm((s) => ({ ...s, accept: e.target.checked }))}
              style={{
                width: 18,
                height: 18,
                marginTop: 1,
                accentColor: COLOR_PRIMARY,
                flexShrink: 0,
                cursor: "pointer",
              }}
            />
            <span>
              Confirmo que conversei com meu amigo e ele autorizou o contato da
              equipe Provider + Fibra. Concordo com o regulamento da campanha.
            </span>
          </label>
          {errors.accept && (
            <div
              role="alert"
              style={{
                marginTop: -10,
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: COLOR_ERROR,
                fontFamily: FONT_NUNITO,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <AlertCircle size={14} aria-hidden />
              <span>{errors.accept}</span>
            </div>
          )}

          {errors.general && (
            <div
              role="alert"
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                background: "#FEF2F2",
                color: "#B91C1C",
                fontFamily: FONT_NUNITO,
                fontWeight: 600,
                fontSize: 13,
                lineHeight: "18px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: "1px solid #FECACA",
              }}
            >
              <AlertCircle size={16} aria-hidden />
              <span>{errors.general}</span>
            </div>
          )}

          <div className="referral-actions" style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              type="button"
              data-testid="button-step-back"
              onClick={() => setStep(1)}
              className="referral-btn referral-btn--ghost"
            >
              <ArrowLeft size={16} /> Voltar
            </button>
            <button
              type="submit"
              data-testid="button-submit"
              disabled={submitting}
              className="referral-btn referral-btn--primary"
              style={{ opacity: submitting ? 0.7 : 1, cursor: submitting ? "wait" : "pointer" }}
            >
              {submitting ? (
                "Enviando…"
              ) : (
                <>
                  Enviar indicação <Send size={16} />
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
      className="referral-hero-banner"
      style={{
        background: COLOR_PRIMARY,
        position: "relative",
        overflow: "hidden",
        lineHeight: 0,
      }}
    >
      <img
        src={heroBannerImage}
        alt="Indique um amigo e ganhe 50% de desconto na sua mensalidade"
        loading="eager"
        decoding="async"
        className="referral-hero-banner__img"
      />
      <style>{`
        .referral-hero-banner__img {
          display: block;
          width: 100%;
          height: auto;
        }
        @media (max-width: 768px) {
          .referral-hero-banner__img {
            width: 100%;
            height: 320px;
            object-fit: cover;
            object-position: 70% center;
          }
        }
        @media (max-width: 480px) {
          .referral-hero-banner__img {
            height: 260px;
            object-position: 75% center;
          }
        }
      `}</style>
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
            fontFamily: FONT_MONTSERRAT,
            fontWeight: 400,
            fontSize: 14,
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
        paddingTop: 96,
        paddingBottom: 80,
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
              fontWeight: 400,
              fontSize: 32,
              lineHeight: "40px",
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
        paddingTop: 80,
        paddingBottom: 96,
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
        <div style={{ textAlign: "center" }}>
          <h2
            style={{
              fontFamily: FONT_MONTSERRAT,
              fontWeight: 400,
              fontSize: 32,
              lineHeight: "40px",
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

type ReferralFaqItem = { q: string; a: string };

function ReferralFaqRow({ item }: { item: ReferralFaqItem }) {
  const [open, setOpen] = useState(false);
  const CHEVRON = `${BASE}images/icons/chevron-down.svg`;
  return (
    <div
      className="bg-white"
      style={{
        border: "1px solid #E8EAEF",
        borderRadius: 12,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between cursor-pointer"
        style={{
          paddingLeft: 24,
          paddingRight: 24,
          paddingTop: 16,
          paddingBottom: 16,
          background: "transparent",
          border: 0,
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontFamily: FONT_MONTSERRAT,
            fontWeight: 700,
            fontSize: 14,
            lineHeight: "20px",
            color: "#0D0E14",
            opacity: 0.61,
          }}
        >
          {item.q}
        </span>
        <img
          src={CHEVRON}
          alt=""
          aria-hidden="true"
          width={18}
          height={18}
          style={{
            display: "block",
            width: 18,
            height: 18,
            flexShrink: 0,
            marginLeft: 16,
            transition: "transform 0.25s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>
      {open && (
        <div
          style={{
            paddingLeft: 24,
            paddingRight: 24,
            paddingBottom: 16,
            fontFamily: FONT_MONTSERRAT,
            fontWeight: 400,
            fontSize: 14,
            lineHeight: "20px",
            color: "#0D0E14",
            opacity: 0.75,
          }}
        >
          {item.a}
        </div>
      )}
    </div>
  );
}

function ReferralFAQ() {
  const allItems: ReferralFaqItem[] = [
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
  const left = allItems.filter((_, i) => i % 2 === 0);
  const right = allItems.filter((_, i) => i % 2 === 1);

  return (
    <section
      id="faq"
      data-testid="referral-faq"
      style={{
        background: "#FBFBFB",
        paddingTop: 96,
        paddingBottom: 110,
      }}
    >
      <div
        className="mx-auto flex flex-col w-full px-6 lg:px-0"
        style={{ maxWidth: 1022, rowGap: 30 }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center"
          style={{ rowGap: 12 }}
        >
          <h2
            className="m-0"
            style={{
              fontFamily: FONT_MONTSERRAT,
              fontWeight: 400,
              fontSize: 32,
              lineHeight: "40px",
              color: "#003F99",
            }}
          >
            Tire suas <span style={{ fontWeight: 800 }}>Dúvidas</span>
          </h2>
          <p
            className="m-0"
            style={{
              fontFamily: FONT_MONTSERRAT,
              fontWeight: 400,
              fontSize: 16,
              lineHeight: "24px",
              color: "#4A4F61",
            }}
          >
            Tudo o que você precisa saber sobre o programa Indique um Amigo
          </p>
        </motion.div>

        <div
          className="grid grid-cols-1 md:grid-cols-2 w-full"
          style={{ columnGap: 22, rowGap: 8 }}
        >
          <div className="flex flex-col" style={{ rowGap: 8 }}>
            {left.map((item) => (
              <ReferralFaqRow key={item.q} item={item} />
            ))}
          </div>
          <div className="flex flex-col" style={{ rowGap: 8 }}>
            {right.map((item) => (
              <ReferralFaqRow key={item.q} item={item} />
            ))}
          </div>
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
        className="pt-16 md:pt-[88px]"
        style={{ background: COLOR_PRIMARY, color: "#FFFFFF" }}
      >
        <div style={{ position: "relative" }}>
          <ReferralHero />
          <section
            data-testid="referral-form-section"
            style={{
              background: "#FFFFFF",
              paddingTop: 80,
              paddingBottom: 80,
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
          .referral-steps {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 599px) {
          .referral-grid {
            grid-template-columns: 1fr !important;
          }
          [data-testid="referral-form-section"] {
            padding-top: 56px !important;
            padding-bottom: 56px !important;
          }
          .referral-actions {
            flex-direction: column-reverse !important;
          }
          .referral-actions .referral-btn--ghost {
            width: 100% !important;
            justify-content: center !important;
          }
        }

        /* Floating-label fields */
        .referral-field {
          position: relative;
        }
        .referral-field__label {
          position: absolute;
          left: 18px;
          top: 18px;
          font-size: 14px;
          font-weight: 400;
          pointer-events: none;
          transition: transform 0.18s ease, color 0.18s ease, font-size 0.18s ease;
          transform-origin: left top;
          background: transparent;
          padding: 0;
          z-index: 1;
        }
        .referral-field__input:focus {
          border-color: ${COLOR_PRIMARY} !important;
          background: #FFFFFF !important;
          box-shadow: 0 0 0 4px rgba(18, 42, 213, 0.10);
        }
        .referral-field:focus-within .referral-field__label,
        .referral-field:has(.referral-field__input:not(:placeholder-shown)) .referral-field__label,
        .referral-field:has(.referral-field__input--select) .referral-field__label {
          transform: translateY(-10px) scale(0.78);
          color: ${COLOR_PRIMARY};
        }

        /* Buttons */
        .referral-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 42px;
          padding: 0 18px;
          border-radius: 10px;
          border: none;
          font-family: ${FONT_MONTSERRAT};
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.01em;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .referral-btn--primary {
          background: ${COLOR_PRIMARY};
          color: #FFFFFF;
          box-shadow: 0 14px 28px -14px rgba(18, 42, 213, 0.55);
        }
        .referral-btn--primary:hover:not(:disabled) {
          background: #0E22B5;
          transform: translateY(-1px);
          box-shadow: 0 18px 32px -14px rgba(18, 42, 213, 0.65);
        }
        .referral-btn--primary:active:not(:disabled) {
          transform: translateY(0);
        }
        .referral-btn--ghost {
          background: transparent;
          color: ${COLOR_PRIMARY};
          border: 1px solid #D8DCE8;
          font-weight: 700;
        }
        .referral-btn--ghost:hover {
          background: #F2F4FB;
          border-color: #C2C7D7;
        }
      `}</style>
    </>
  );
}
