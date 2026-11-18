
(function setupFirstVisitGuides() {
  const guides = {
    dashboard: ['Painel', 'Aqui você vê um resumo da sua evolução.',
      'Toque em “Novo registro” para anotar o que fez hoje.',
      'No gráfico, escolha um período para ver seus pontos.'],
    progress: ['Meu progresso', 'Aqui ficam suas áreas, metas e registros.',
      'Use “Nova área” para adicionar algo que quer acompanhar, como Estudos.',
      'Associe seus próximos registros a essa área para acompanhar a meta.'],
    day: ['Meu dia', 'Use este espaço para anotar como você está e o que viveu hoje.',
      'No check-in, escolha seu humor e nível de energia.',
      'No diário, escolha a data, escreva sua anotação e salve.'],
    community: ['Comunidade', 'Explore o feed de relatos e encontre temas que interessam a você.',
      'Toque em “Escrever relato” para enviar um relato, com opção de anonimato.',
      'Após a revisão, seu relato aparece no mural das outras contas.'],
    myProfile: ['Meu perfil', 'Personalize seu espaço na comunidade.',
      'Escolha um nome de usuário e como quer ser chamado.',
      'Adicione uma descrição, se quiser, e salve. Seu perfil começa privado.'],
    profile: ['Perfil da comunidade', 'Veja como a pessoa escolheu se apresentar.',
      'Leia os detalhes e os relatos disponíveis no perfil.',
      'Use “Voltar à comunidade” para retornar ao feed.'],
    reports: ['Relatórios', 'Acompanhe a frequência dos seus registros e veja como seus pontos mudaram.',
      'Escolha o período no gráfico.',
      'Veja o foco da semana para saber em quantos dias você registrou algum passo.'],
    tips: ['Dicas do dia', 'Encontre uma ideia simples para o seu momento.',
      'Escolha como você está se sentindo.',
      'Toque em “Me dê uma ideia” e adapte a sugestão à sua rotina.'],
    support: ['Saúde mental', 'Encontre informações e opções de apoio.',
      'Leia os cartões para conhecer as opções disponíveis.',
      'Na busca por atendimento, digite sua região para procurar serviços próximos.'],
    about: ['Como funciona', 'Conheça a proposta do Meu Progresso.',
      'Leia a página para entender como o site ajuda a acompanhar seus passos.',
      'Use o menu para voltar ao Painel e fazer seu primeiro registro.'],
    evolution: ['Sua evolução', 'Compare suas semanas e veja mudanças nas suas áreas.',
      'A análise libera depois de duas semanas com registros.',
      'Escolha um período para explorar seus dados. Para sair, use “Voltar ao meu espaço”.'],
    staff: ['Central da equipe', 'Aqui ficam as ferramentas disponíveis para sua função.',
      'Use as abas da central para alternar entre as ferramentas às quais você tem acesso.']
  };
  const dialog = document.getElementById('firstVisitGuide');
  const seen = new Set();
  const key = 'mp_seen_guide_';
  let timer;
  function hasSeen(page) {
    try { return seen.has(page) || window.mpAccountStorage.getItem(key + page) === '1'; }
    catch { return seen.has(page); }
  }
  function showGuide(page) {
    const guide = guides[page];
    if (!guide || hasSeen(page) || activePage !== page || dialog.open) return;
    const [title, intro, ...steps] = guide;
    dialog.querySelector('#guideTitle').textContent = 'Como usar · ' + title;
    dialog.querySelector('#guideIntro').textContent = intro;
    dialog.querySelector('#guideSteps').replaceChildren(...steps.map(step => {
      const item = document.createElement('li');
      item.textContent = step;
      return item;
    }));
    dialog.showModal();
    seen.add(page);
    try { window.mpAccountStorage.setItem(key + page, '1'); } catch {}
  }
  function scheduleGuide(page) {
    clearTimeout(timer);
    const portalActive = document.querySelector('#evolutionPortal.portal-active');
    if (portalActive) timer = setTimeout(() => showGuide(page), 1650);
    else showGuide(page);
  }
  document.addEventListener('mp:page', event => scheduleGuide(event.detail));
  scheduleGuide(activePage);
})();
