// Conteúdo da Política de Privacidade (reutilizado na tela e no cadastro).
export function PoliticaConteudo() {
  return (
    <div className="policy">
      <p>Sua privacidade é levada a sério no Moments. Em resumo: <b>o que é seu é só seu</b>.</p>

      <h4>O que guardamos</h4>
      <p>Apenas o que você cria no app: compromissos, tarefas, metas, hábitos, finanças,
        diário, pessoas, arquivos e preferências. Sua <b>senha</b> é guardada de forma
        <b> criptografada</b> (ninguém consegue vê-la). O <b>relato do diário</b> é guardado
        <b> criptografado</b> no banco de dados.</p>

      <h4>Quem tem acesso</h4>
      <p><b>Nenhum outro usuário</b> vê seus dados — só você, e o que você escolher
        compartilhar (por e-mail) com alguém da sua família. Tecnicamente, têm acesso aos
        servidores: você (dono do app) e os provedores de nuvem usados (banco e hospedagem),
        como em qualquer aplicativo. Os dados <b>não</b> são de conhecimento-zero.</p>

      <h4>Inteligência artificial</h4>
      <p>Quando você usa o <b>assistente</b> ou a <b>voz</b>, o texto (e um resumo dos seus
        dados) ou o áudio são enviados a um provedor de IA para gerar a resposta/transcrição.
        Você pode <b>desligar a IA</b> em Configurações — aí nada é enviado a provedores
        externos (o assistente passa a usar um motor simples e a voz fica indisponível).</p>

      <h4>Segurança</h4>
      <p>Todo o tráfego é por conexão segura (HTTPS). Há proteção contra tentativas de login
        em massa e as senhas nunca são guardadas em texto.</p>

      <h4>Seus direitos</h4>
      <p>Você pode editar ou excluir seus dados a qualquer momento no app. Para apagar sua
        conta por completo, fale com o responsável pelo app.</p>

      <p className="policy-foot">Esta é uma versão simples e inicial. Ao usar o Moments, você
        concorda com estes termos.</p>
    </div>
  );
}

export function Privacidade({ onBack }: { onBack: () => void }) {
  return (
    <>
      <button className="back" onClick={onBack}>‹ Mais</button>
      <div className="hero"><h1 className="scr-title">Privacidade</h1><p className="scr-sub">Como seus dados são tratados.</p></div>
      <section>
        <div className="card pad">
          <PoliticaConteudo />
        </div>
      </section>
    </>
  );
}
