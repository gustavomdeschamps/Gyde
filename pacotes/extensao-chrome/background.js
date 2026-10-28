// Gyde para Chrome — processo de fundo: abre o painel e cria o menu do botão direito.

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  chrome.contextMenus.create({ id: 'gyde-explicar', title: 'Explicar com o Gyde', contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'gyde-revisar', title: 'Revisar este código com o Gyde', contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'gyde-pagina', title: 'Perguntar ao Gyde sobre esta página', contexts: ['page'] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // Abrir o painel precisa acontecer já dentro do clique do usuário.
  await chrome.sidePanel.open({ tabId: tab.id });
  const pedidos = {
    'gyde-explicar': 'Explique este trecho de forma simples:',
    'gyde-revisar': '/revisar Revise este código:',
    'gyde-pagina': 'Resuma esta página e me diga os pontos principais.',
  };
  await chrome.storage.session.set({
    pending: {
      prompt: pedidos[info.menuItemId],
      selection: info.selectionText || '',
      readPage: info.menuItemId === 'gyde-pagina',
      tabId: tab.id,
      title: tab.title,
      url: tab.url,
      at: Date.now(),
    },
  });
});
