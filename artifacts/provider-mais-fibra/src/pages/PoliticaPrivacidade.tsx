import SEO from "@/components/SEO";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import WhatsAppFloat from "@/components/sections/WhatsAppFloat";

export default function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Política de Privacidade — Provider Mais Fibra"
        description="Saiba como a Provider Mais Fibra coleta, utiliza, armazena e protege seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD)."
        path="/politica-de-privacidade"
        keywords={["política de privacidade", "LGPD", "Provider Mais Fibra", "proteção de dados"]}
      />
      <Header />

      <main id="main-content" tabIndex={-1} className="flex-1 pt-16 focus:outline-none">
        <section
          className="py-20"
          style={{ background: "linear-gradient(135deg, #0A1995 0%, #122AD5 100%)" }}
        >
          <div className="max-w-[900px] mx-auto px-4 sm:px-8 lg:px-16">
            <h1
              className="text-white mb-3 leading-tight"
              style={{ letterSpacing: "-0.02em", fontSize: 40, fontWeight: 500 }}
            >
              Política de Privacidade
            </h1>
            <p className="text-white/70 text-base">
              Última atualização: 13 de maio de 2026
            </p>
          </div>
        </section>

        <section className="py-16 bg-white">
          <article
            className="max-w-[820px] mx-auto px-4 sm:px-8 lg:px-16 text-[#2A2F3D] text-base leading-relaxed"
            style={{ fontFamily: "'Nunito', system-ui, sans-serif" }}
          >
            <p className="mb-6">
              A Provider Mais Fibra (CNPJ 28.632.900/0001-70) tem o compromisso
              de respeitar a sua privacidade e proteger os dados pessoais que
              você compartilha com a gente. Esta Política descreve, de forma
              clara, como coletamos, usamos, armazenamos e protegemos as suas
              informações, em conformidade com a Lei Geral de Proteção de
              Dados (LGPD — Lei nº 13.709/2018).
            </p>

            <h2 className="text-[#122AD5] font-bold text-2xl mt-10 mb-4">
              1. Quais dados coletamos
            </h2>
            <p className="mb-4">Podemos coletar os seguintes dados:</p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li>
                <strong>Dados cadastrais:</strong> nome completo, CPF/CNPJ, RG,
                data de nascimento, endereço de instalação e cobrança.
              </li>
              <li>
                <strong>Dados de contato:</strong> e-mail, telefone fixo e
                celular (incluindo WhatsApp).
              </li>
              <li>
                <strong>Dados financeiros:</strong> informações necessárias para
                pagamento (boleto, cartão, Pix), histórico de faturas.
              </li>
              <li>
                <strong>Dados técnicos:</strong> endereço IP, identificador do
                modem/ONU, dados de uso da rede, logs de conexão (mantidos por
                no mínimo 1 ano, conforme Marco Civil da Internet).
              </li>
              <li>
                <strong>Dados de navegação no site:</strong> cookies, páginas
                visitadas, dispositivo e navegador utilizados.
              </li>
            </ul>

            <h2 className="text-[#122AD5] font-bold text-2xl mt-10 mb-4">
              2. Para que usamos seus dados
            </h2>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li>Executar o contrato de prestação do serviço de internet e IPTV.</li>
              <li>Realizar análise de viabilidade técnica e instalação.</li>
              <li>Emitir faturas, processar pagamentos e prevenir fraudes.</li>
              <li>Prestar suporte técnico e atendimento ao cliente.</li>
              <li>Cumprir obrigações legais e regulatórias (Anatel, Receita Federal, autoridades competentes).</li>
              <li>Enviar comunicações sobre o seu plano, manutenções e novidades — com a sua autorização para fins de marketing.</li>
              <li>Melhorar a qualidade da rede e a sua experiência no site.</li>
            </ul>

            <h2 className="text-[#122AD5] font-bold text-2xl mt-10 mb-4">
              3. Compartilhamento de dados
            </h2>
            <p className="mb-6">
              A Provider Mais Fibra não vende seus dados. Podemos
              compartilhá-los apenas com: (i) parceiros essenciais à operação
              (ex.: meios de pagamento, emissão de notas fiscais, plataforma de
              IPTV), sob obrigação contratual de confidencialidade; (ii)
              autoridades públicas, mediante requisição legal ou judicial;
              (iii) empresas do mesmo grupo econômico, quando aplicável e nos
              limites desta Política.
            </p>

            <h2 className="text-[#122AD5] font-bold text-2xl mt-10 mb-4">
              4. Seus direitos como titular (LGPD)
            </h2>
            <p className="mb-4">A qualquer momento, você pode solicitar:</p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li>Confirmação da existência de tratamento dos seus dados;</li>
              <li>Acesso, correção ou atualização dos dados;</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
              <li>Portabilidade a outro fornecedor;</li>
              <li>Revogação do consentimento, quando aplicável.</li>
            </ul>
            <p className="mb-6">
              Para exercer qualquer um desses direitos, entre em contato pelo
              WhatsApp <strong>(77) 99844-4757</strong> ou pelo e-mail{" "}
              <a
                href="mailto:contato@providermaisfibra.com.br"
                className="text-[#122AD5] underline"
              >
                contato@providermaisfibra.com.br
              </a>
              .
            </p>

            <h2 className="text-[#122AD5] font-bold text-2xl mt-10 mb-4">
              5. Segurança e retenção
            </h2>
            <p className="mb-6">
              Adotamos medidas técnicas e organizacionais para proteger seus
              dados contra acesso não autorizado, perda ou alteração indevida.
              Os dados são mantidos pelo tempo necessário ao cumprimento das
              finalidades descritas e das obrigações legais aplicáveis.
            </p>

            <h2 className="text-[#122AD5] font-bold text-2xl mt-10 mb-4">
              6. Cookies
            </h2>
            <p className="mb-6">
              Utilizamos cookies essenciais para o funcionamento do site e
              cookies analíticos para entender como ele é usado. Você pode
              gerenciar os cookies nas configurações do seu navegador.
            </p>

            <h2 className="text-[#122AD5] font-bold text-2xl mt-10 mb-4">
              7. Alterações desta Política
            </h2>
            <p className="mb-6">
              Esta Política pode ser atualizada a qualquer momento. A versão
              vigente estará sempre disponível nesta página, com a respectiva
              data de atualização.
            </p>

            <h2 className="text-[#122AD5] font-bold text-2xl mt-10 mb-4">
              8. Contato
            </h2>
            <p>
              Provider Mais Fibra — CNPJ 28.632.900/0001-70.
              <br />
              WhatsApp: (77) 99844-4757
              <br />
              E-mail:{" "}
              <a
                href="mailto:contato@providermaisfibra.com.br"
                className="text-[#122AD5] underline"
              >
                contato@providermaisfibra.com.br
              </a>
            </p>
          </article>
        </section>
      </main>

      <Footer />
      <WhatsAppFloat source="politica-privacidade-sticky" />
    </div>
  );
}
