import SEO from "@/components/SEO";
import Header from "@/components/sections/Header";
import Footer from "@/components/sections/Footer";
import WhatsAppFloat from "@/components/sections/WhatsAppFloat";

export default function TermosDeUso() {
  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Termos de Uso — Provider Mais Fibra"
        description="Conheça os Termos de Uso do site e dos serviços da Provider Mais Fibra, provedor de internet 100% fibra óptica do Oeste da Bahia."
        path="/termos-de-uso"
        keywords={["termos de uso", "Provider Mais Fibra", "contrato de prestação de serviços"]}
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
              Termos de Uso
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
              Estes Termos de Uso regulam o acesso e a utilização do site e
              dos serviços oferecidos pela Provider Mais Fibra (CNPJ
              28.632.900/0001-70). Ao navegar pelo site ou contratar nossos
              serviços, você declara estar de acordo com as condições abaixo.
            </p>

            <h2 className="text-[#122AD5] font-bold text-2xl mt-10 mb-4">
              1. Sobre a Provider Mais Fibra
            </h2>
            <p className="mb-6">
              A Provider Mais Fibra é provedora de acesso à internet em
              regime privado, devidamente homologada pela Anatel, atuando no
              Oeste da Bahia. Oferecemos planos residenciais e empresariais
              em fibra óptica, além de serviços de IPTV e streaming
              integrados.
            </p>

            <h2 className="text-[#122AD5] font-bold text-2xl mt-10 mb-4">
              2. Uso do site
            </h2>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li>
                O conteúdo do site (textos, imagens, marcas, logotipos,
                layout) é protegido por direitos autorais e de propriedade
                intelectual. É proibida a reprodução total ou parcial sem
                autorização prévia e por escrito.
              </li>
              <li>
                Você se compromete a utilizar o site de forma ética, sem
                praticar qualquer ato que comprometa a segurança, o
                funcionamento ou a integridade dos serviços.
              </li>
              <li>
                A Provider pode atualizar, suspender ou descontinuar
                funcionalidades do site a qualquer momento, sem aviso prévio.
              </li>
            </ul>

            <h2 className="text-[#122AD5] font-bold text-2xl mt-10 mb-4">
              3. Contratação dos serviços
            </h2>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li>
                A contratação está sujeita à viabilidade técnica de
                instalação no endereço informado.
              </li>
              <li>
                Os preços, velocidades e franquias divulgados no site podem
                variar conforme a localidade. As condições definitivas
                constam no contrato de adesão assinado no momento da
                contratação.
              </li>
              <li>
                As velocidades anunciadas representam a velocidade nominal
                contratada. Os índices mínimos garantidos seguem a
                regulamentação da Anatel.
              </li>
            </ul>

            <h2 className="text-[#122AD5] font-bold text-2xl mt-10 mb-4">
              4. Direito de arrependimento
            </h2>
            <p className="mb-6">
              Quando a contratação for realizada fora do estabelecimento
              comercial (site, telefone ou WhatsApp), o cliente tem direito
              ao arrependimento em até 7 dias corridos a contar da
              instalação, conforme art. 49 do Código de Defesa do
              Consumidor.
            </p>

            <h2 className="text-[#122AD5] font-bold text-2xl mt-10 mb-4">
              5. Pagamentos e inadimplência
            </h2>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li>
                As mensalidades devem ser quitadas até a data de vencimento
                indicada na fatura.
              </li>
              <li>
                Em caso de atraso, poderão ser aplicados juros de 1% ao mês
                e multa de 2%, além de eventual suspensão do serviço, com
                aviso prévio nos termos da regulamentação Anatel.
              </li>
            </ul>

            <h2 className="text-[#122AD5] font-bold text-2xl mt-10 mb-4">
              6. Suporte e cancelamento
            </h2>
            <p className="mb-6">
              O suporte técnico e o atendimento comercial são realizados
              prioritariamente pelo WhatsApp <strong>(77) 99844-4757</strong>.
              O cancelamento pode ser solicitado a qualquer tempo pelos
              mesmos canais, observados os prazos contratuais e eventuais
              valores residuais.
            </p>

            <h2 className="text-[#122AD5] font-bold text-2xl mt-10 mb-4">
              7. Limitação de responsabilidade
            </h2>
            <p className="mb-6">
              A Provider Mais Fibra empreende seus melhores esforços para
              manter a estabilidade da rede, mas não se responsabiliza por
              indisponibilidades decorrentes de caso fortuito, força maior,
              falha de equipamentos do cliente, ou interrupções
              programadas previamente comunicadas.
            </p>

            <h2 className="text-[#122AD5] font-bold text-2xl mt-10 mb-4">
              8. Privacidade
            </h2>
            <p className="mb-6">
              O tratamento dos dados pessoais coletados está descrito na{" "}
              <a href="/politica-de-privacidade" className="text-[#122AD5] underline">
                Política de Privacidade
              </a>
              , que faz parte integrante destes Termos.
            </p>

            <h2 className="text-[#122AD5] font-bold text-2xl mt-10 mb-4">
              9. Foro e legislação aplicável
            </h2>
            <p className="mb-6">
              Estes Termos são regidos pela legislação brasileira. Fica
              eleito o foro da comarca de Barreiras/BA para dirimir
              quaisquer questões oriundas deste documento, sem prejuízo de
              outros foros previstos em lei para o consumidor.
            </p>

            <h2 className="text-[#122AD5] font-bold text-2xl mt-10 mb-4">
              10. Contato
            </h2>
            <p>
              Provider Mais Fibra — CNPJ 28.632.900/0001-70.
              <br />
              WhatsApp: (77) 99844-4757
              <br />
              E-mail:{" "}
              <a
                href="mailto:contato@maisfibratelecom.net.br"
                className="text-[#122AD5] underline"
              >
                contato@maisfibratelecom.net.br
              </a>
            </p>
          </article>
        </section>
      </main>

      <Footer />
      <WhatsAppFloat source="termos-uso-sticky" />
    </div>
  );
}
