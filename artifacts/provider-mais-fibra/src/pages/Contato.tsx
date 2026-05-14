import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Instagram,
  Clock,
  MapPin,
  ChevronDown,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { Link } from "wouter";
import SEO from "@/components/SEO";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import WhatsAppFloat from "@/components/sections/WhatsAppFloat";
import {
  buildBreadcrumbSchema,
  buildLocalBusinessSchemas,
} from "@/lib/seoConfig";
import { cities as allCities } from "@/lib/cities";
import { useAppSettings } from "@/hooks/useAppSettings";
import {
  MESSAGE_MAX,
  maskWhatsappInput,
  sanitizeNameInput,
  validateCity,
  validateEmail,
  validateMessage,
  validateName,
  validateReason,
  validateWhatsapp,
} from "@/lib/contactValidation";

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

const reasons = [
  "Quero assinar um plano",
  "Suporte técnico",
  "2ª via de boleto",
  "Cancelamento",
  "Alterar plano",
  "Reclamação",
  "Outro",
];

const FAMILY_IMG = `${import.meta.env.BASE_URL}images/photos/family-contact.png`;

type FormState = {
  name: string;
  email: string;
  phone: string;
  city: string;
  reason: string;
  message: string;
  accept: boolean;
  website: string; // honeypot
};

type FormErrors = Partial<Record<keyof FormState, string | null>>;

import { loadRecaptcha, getRecaptchaToken } from "../lib/recaptcha";

export default function Contato() {
  const settings = useAppSettings();
  const recaptchaEnabled = settings.recaptcha_enabled === "true";
  const recaptchaSiteKey = settings.recaptcha_site_key;
  const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    city: "",
    reason: "",
    message: "",
    accept: false,
    website: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Time-trap: server issues an HMAC-signed token at form mount. We send it
  // back on submit so the server can verify the form was opened > 2s ago and
  // < 30min ago — without trusting a client-supplied timestamp.
  const trapTokenRef = useRef<string | null>(null);
  const captureStart = () => {
    if (trapTokenRef.current != null) return;
    fetch(`${baseUrl}/api/contact/token`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.token === "string") trapTokenRef.current = data.token;
      })
      .catch(() => {
        /* the submit will fail with a clear error */
      });
  };

  // Lazy-load reCAPTCHA when enabled.
  useEffect(() => {
    if (recaptchaEnabled && recaptchaSiteKey) {
      loadRecaptcha(recaptchaSiteKey).catch(() => {
        // ignore — server will still validate; if enabled, submit will warn
      });
    }
  }, [recaptchaEnabled, recaptchaSiteKey]);

  function validateField(field: keyof FormState, value: string | boolean): string | null {
    switch (field) {
      case "name":
        return validateName(String(value));
      case "email":
        return validateEmail(String(value));
      case "phone":
        return validateWhatsapp(String(value));
      case "city":
        return validateCity(String(value));
      case "reason":
        return validateReason(String(value));
      case "message":
        return validateMessage(String(value));
      case "accept":
        return value ? null : "Aceite a Política de Privacidade.";
      default:
        return null;
    }
  }

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (touched[field] || field === "accept") {
      setErrors((prev) => ({
        ...prev,
        [field]: validateField(field, value as string | boolean),
      }));
    }
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    captureStart();
    const cleaned = sanitizeNameInput(e.target.value);
    setField("name", cleaned);
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    captureStart();
    const masked = maskWhatsappInput(e.target.value, form.phone);
    setField("phone", masked);
  }

  function handleBlur(field: keyof FormState) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({
      ...prev,
      [field]: validateField(field, form[field] as string | boolean),
    }));
  }

  function runAllValidations(): FormErrors {
    return {
      name: validateField("name", form.name),
      email: validateField("email", form.email),
      phone: validateField("phone", form.phone),
      city: validateField("city", form.city),
      reason: validateField("reason", form.reason),
      message: validateField("message", form.message),
      accept: validateField("accept", form.accept),
    };
  }

  const allValid = (() => {
    const e = runAllValidations();
    return (Object.keys(e) as Array<keyof FormErrors>).every((k) => !e[k]);
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const validation = runAllValidations();
    setErrors(validation);
    setTouched({
      name: true, email: true, phone: true,
      city: true, reason: true, message: true, accept: true,
    });
    const firstErr = (Object.keys(validation) as Array<keyof FormErrors>).find(
      (k) => validation[k],
    );
    if (firstErr) return;

    setSubmitting(true);
    try {
      let recaptchaToken = "";
      if (recaptchaEnabled && recaptchaSiteKey) {
        try {
          recaptchaToken = await getRecaptchaToken(recaptchaSiteKey, "contact");
        } catch {
          setSubmitError(
            "Não foi possível carregar a verificação anti-robô. Recarregue a página.",
          );
          setSubmitting(false);
          return;
        }
      }

      // Make sure we have a trap token. If the initial fetch hasn't completed
      // yet (or failed), grab one now and wait the minimum form age.
      if (!trapTokenRef.current) {
        try {
          const tokRes = await fetch(`${baseUrl}/api/contact/token`);
          if (tokRes.ok) {
            const tokData = (await tokRes.json()) as { token?: string };
            if (tokData.token) trapTokenRef.current = tokData.token;
          }
          await new Promise((r) => setTimeout(r, 2200));
        } catch {
          setSubmitError("Sem conexão para validar o envio. Tente novamente.");
          setSubmitting(false);
          return;
        }
      }

      const res = await fetch(`${baseUrl}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          city: form.city,
          reason: form.reason,
          message: form.message,
          accept: form.accept,
          website: form.website, // honeypot
          _t: trapTokenRef.current,
          recaptchaToken,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        whatsappUrl?: string;
        error?: string;
        errors?: Array<{ field: string; message: string }>;
      };

      if (!res.ok || !data.ok) {
        if (Array.isArray(data.errors)) {
          const fieldErrors: FormErrors = {};
          for (const e of data.errors) {
            (fieldErrors as Record<string, string>)[e.field] = e.message;
          }
          setErrors((prev) => ({ ...prev, ...fieldErrors }));
        }
        setSubmitError(data.error ?? "Não foi possível enviar. Verifique os campos e tente novamente.");
        setSubmitting(false);
        return;
      }

      if (data.whatsappUrl) {
        window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
      }
      // reset form so a fresh time-trap token is required for the next send
      trapTokenRef.current = null;
      setForm({
        name: "",
        email: "",
        phone: "",
        city: "",
        reason: "",
        message: "",
        accept: false,
        website: "",
      });
      setTouched({});
      setErrors({});
    } catch {
      setSubmitError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  const labelClass = "block text-[13px] font-medium text-[#122AD5] mb-1.5";
  const inputBase =
    "w-full px-4 py-2.5 rounded-md text-[15px] text-[#0D0D0D] bg-white border outline-none focus:outline-none focus-visible:outline-none transition-colors duration-150";
  function inputCls(field: keyof FormState) {
    const hasError = touched[field] && errors[field];
    return `${inputBase} ${
      hasError
        ? "border-[#E53935] focus:border-[#E53935]"
        : "border-[#E2E5EC] focus:border-[#122AD5]/60"
    }`;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEO
        title="Contato — Provider Mais Fibra"
        description="Fale com a Provider Mais Fibra: WhatsApp (77) 99844-4757, Instagram @provider.fibra e atendimento de seg a sex 8h–18h. Tire dúvidas, contrate planos e peça suporte."
        path="/contato"
        keywords={[
          "contato Provider Mais Fibra",
          "telefone Provider Mais Fibra",
          "WhatsApp Provider Mais Fibra",
          "suporte internet Barreiras",
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "ContactPage",
            name: "Contato — Provider Mais Fibra",
            url: "https://www.providermaisfibra.com.br/contato",
            inLanguage: "pt-BR",
          },
          buildBreadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Contato", path: "/contato" },
          ]),
          ...buildLocalBusinessSchemas(
            allCities
              .filter((c) => c.slug === "barreiras")
              .map((c) => ({
                slug: c.slug,
                name: c.name,
                address: c.address,
                stateCode: c.stateCode,
                phones: c.phones,
              })),
          ),
        ]}
      />
      <Header />

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 pt-16 md:pt-[88px] focus:outline-none"
      >
        {/* HERO ---------------------------------------------------------- */}
        <section className="bg-white pt-12 md:pt-20 pb-14 md:pb-24">
          <div className="max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-10">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h1
                  className="text-[#122AD5] font-bold mb-6 text-[36px] md:text-[44px] leading-[1.1]"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  Quer falar com a gente?
                </h1>
                <p className="text-[15px] md:text-[16px] text-[#4A4F61] leading-relaxed max-w-[480px]">
                  Se você tem alguma dúvida, precisa contratar um plano, pedir
                  suporte técnico ou enviar uma sugestão, este é o lugar ideal.
                  Responda o formulário abaixo com a sua solicitação e nossa
                  equipe vai responder em breve.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="relative"
              >
                <div className="overflow-hidden rounded-[20px] aspect-[4/3] bg-[#F5F6FA]">
                  <img
                    src={FAMILY_IMG}
                    alt="Família conectada à internet fibra óptica da Provider Mais Fibra"
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* FORM SECTION -------------------------------------------------- */}
        <section className="bg-[#FAFBFC] py-16 md:py-24">
          <div className="max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-10">
            <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
              {/* Left column — Whatsapp pitch */}
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="lg:col-span-5 lg:pt-6"
              >
                <p className="text-[15px] text-[#0D0D0D] mb-3 leading-relaxed">
                  <span className="font-bold text-[#122AD5]">Novidade!</span>{" "}
                  Agora você pode entrar em contato também pela nossa{" "}
                  <span className="font-bold text-[#122AD5]">
                    Central de WhatsApp
                  </span>
                  .
                </p>
                <p className="text-[14px] text-[#6B7280] leading-relaxed mb-6">
                  A Provider Mais Fibra também possui um canal exclusivo pelo
                  WhatsApp, basta clicar no botão abaixo e enviar uma mensagem
                  direto para nossa Central de Atendimento.
                </p>
                <a
                  href="https://wa.me/5577998444757"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-[14px] font-semibold text-white bg-[#25D366] hover:bg-[#20BD5A] transition-colors"
                >
                  <MessageCircle size={18} strokeWidth={2.2} />
                  Falar pelo WhatsApp
                </a>

                <div className="mt-10 space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#EEF1FF] flex items-center justify-center flex-shrink-0">
                      <Clock size={16} className="text-[#122AD5]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-[#0D0D0D] mb-0.5">
                        Atendimento
                      </p>
                      <p className="text-[13px] text-[#6B7280] leading-relaxed">
                        Seg a Sex: 08h às 18h · Sábado: 08h às 12h · Suporte 24h via WhatsApp
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#EEF1FF] flex items-center justify-center flex-shrink-0">
                      <MapPin size={16} className="text-[#122AD5]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-[#0D0D0D] mb-0.5">
                        Cobertura
                      </p>
                      <p className="text-[13px] text-[#6B7280] leading-relaxed">
                        Atendemos {allCities.length} cidades no Oeste da Bahia.{" "}
                        <Link
                          href="/onde-estamos"
                          className="text-[#122AD5] font-semibold hover:underline"
                        >
                          Ver cidades
                        </Link>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#EEF1FF] flex items-center justify-center flex-shrink-0">
                      <Instagram size={16} className="text-[#122AD5]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-[#0D0D0D] mb-0.5">
                        Instagram
                      </p>
                      <a
                        href="https://instagram.com/provider.fibra"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-[#6B7280] hover:text-[#122AD5]"
                      >
                        @provider.fibra
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Right column — Form */}
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="lg:col-span-7"
              >
                <div className="bg-white rounded-[16px] border border-[#E8EAEF] p-7 md:p-10">
                  <h2 className="text-[22px] md:text-[24px] font-bold text-[#122AD5] mb-2">
                    Fale conosco sempre que precisar
                  </h2>
                  <p className="text-[14px] text-[#6B7280] leading-relaxed mb-7">
                    Entre em contato com a Provider pelo nosso formulário de
                    contato, via nossos canais de atendimento ou se preferir,
                    venha até uma loja.
                  </p>

                  <form
                    onSubmit={handleSubmit}
                    onFocus={captureStart}
                    noValidate
                    className="space-y-5"
                  >
                    {/* Honeypot — visually hidden but not display:none so it
                        still gets serialized and blurred bots can find it. */}
                    <div
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: "-9999px",
                        top: "-9999px",
                        width: 1,
                        height: 1,
                        overflow: "hidden",
                      }}
                    >
                      <label>
                        Não preencha este campo:
                        <input
                          type="text"
                          name="website"
                          tabIndex={-1}
                          autoComplete="off"
                          value={form.website}
                          onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                        />
                      </label>
                    </div>

                    <Field
                      label="Nome completo"
                      htmlFor="c-name"
                      error={touched.name ? errors.name : null}
                    >
                      <input
                        id="c-name"
                        type="text"
                        name="name"
                        autoComplete="name"
                        maxLength={80}
                        value={form.name}
                        onChange={handleNameChange}
                        onBlur={() => handleBlur("name")}
                        className={inputCls("name")}
                        placeholder="Ex.: Maria Silva"
                      />
                    </Field>

                    <Field
                      label="E-mail"
                      htmlFor="c-email"
                      error={touched.email ? errors.email : null}
                    >
                      <input
                        id="c-email"
                        type="email"
                        name="email"
                        autoComplete="email"
                        maxLength={254}
                        inputMode="email"
                        value={form.email}
                        onChange={(e) => {
                          captureStart();
                          setField("email", e.target.value);
                        }}
                        onBlur={() => handleBlur("email")}
                        className={inputCls("email")}
                      />
                    </Field>

                    <Field
                      label="WhatsApp"
                      htmlFor="c-phone"
                      error={touched.phone ? errors.phone : null}
                    >
                      <input
                        id="c-phone"
                        type="tel"
                        name="phone"
                        autoComplete="tel"
                        inputMode="numeric"
                        value={form.phone}
                        onChange={handlePhoneChange}
                        onBlur={() => handleBlur("phone")}
                        placeholder="(__) _____-____"
                        className={inputCls("phone")}
                      />
                    </Field>

                    <Field
                      label="Cidade"
                      htmlFor="c-city"
                      error={touched.city ? errors.city : null}
                    >
                      <div className="relative">
                        <select
                          id="c-city"
                          name="city"
                          value={form.city}
                          onChange={(e) => {
                            captureStart();
                            setField("city", e.target.value);
                          }}
                          onBlur={() => handleBlur("city")}
                          className={`${inputCls("city")} appearance-none pr-10`}
                        >
                          <option value="">Selecione a cidade</option>
                          {cityOptions.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={16}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none"
                        />
                      </div>
                    </Field>

                    <Field
                      label="Assunto"
                      htmlFor="c-reason"
                      error={touched.reason ? errors.reason : null}
                    >
                      <div className="relative">
                        <select
                          id="c-reason"
                          name="reason"
                          value={form.reason}
                          onChange={(e) => {
                            captureStart();
                            setField("reason", e.target.value);
                          }}
                          onBlur={() => handleBlur("reason")}
                          className={`${inputCls("reason")} appearance-none pr-10`}
                        >
                          <option value="">Selecione o assunto</option>
                          {reasons.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={16}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none"
                        />
                      </div>
                    </Field>

                    <Field
                      label="Mensagem"
                      htmlFor="c-message"
                      error={touched.message ? errors.message : null}
                      hint={`${form.message.length}/${MESSAGE_MAX}`}
                    >
                      <textarea
                        id="c-message"
                        name="message"
                        rows={4}
                        maxLength={MESSAGE_MAX}
                        value={form.message}
                        onChange={(e) => {
                          captureStart();
                          setField("message", e.target.value);
                        }}
                        onBlur={() => handleBlur("message")}
                        className={`${inputCls("message")} resize-none`}
                      />
                    </Field>

                    <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        name="accept"
                        checked={form.accept}
                        onChange={(e) => {
                          captureStart();
                          setField("accept", e.target.checked);
                        }}
                        className="mt-0.5 w-4 h-4 accent-[#122AD5] cursor-pointer flex-shrink-0"
                      />
                      <span className="text-[13px] text-[#6B7280] leading-relaxed">
                        Ao enviar, você concorda com nossa{" "}
                        <Link
                          href="/politica-de-privacidade"
                          className="text-[#122AD5] font-medium hover:underline"
                        >
                          Política de Privacidade
                        </Link>
                        .
                      </span>
                    </label>

                    {submitError && (
                      <div
                        role="alert"
                        className="flex items-start gap-2 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-md px-3 py-2.5 text-[13px]"
                      >
                        <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                        <span>{submitError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!allValid || submitting}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-md font-semibold text-[15px] text-white bg-[#122AD5] hover:bg-[#0E22B5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting ? "Enviando..." : "Enviar"}
                      {!submitting && <ArrowRight size={16} />}
                    </button>

                    {recaptchaEnabled && recaptchaSiteKey && (
                      <p className="text-[11px] text-[#9CA3AF] text-center leading-relaxed">
                        Este site é protegido pelo reCAPTCHA. Aplicam-se a{" "}
                        <a
                          href="https://policies.google.com/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          Política de Privacidade
                        </a>{" "}
                        e os{" "}
                        <a
                          href="https://policies.google.com/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          Termos
                        </a>{" "}
                        do Google.
                      </p>
                    )}
                  </form>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppFloat source="contato-sticky" />
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | null;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label htmlFor={htmlFor} className="block text-[13px] font-medium text-[#122AD5]">
          {label}
        </label>
        {hint && <span className="text-[11px] text-[#9CA3AF]">{hint}</span>}
      </div>
      {children}
      {error && (
        <p className="mt-1.5 text-[12px] text-[#E53935] flex items-center gap-1">
          <AlertCircle size={12} />
          {error}
        </p>
      )}
    </div>
  );
}
