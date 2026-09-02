// sw-notif.js — Service Worker exclusivo para exibir notificações locais
// (novos chamados) no CSSL Central TI. Necessário porque no Android/mobile
// o navegador não permite "new Notification(...)" fora de um Service Worker.
// Não faz cache nem intercepta requisições — só cuida de notificações.

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

// ADIÇÃO: recebe o push de verdade mandado pela Edge Function do Supabase
// (funciona mesmo com o app/aba fechados, não só em segundo plano).
self.addEventListener('push', function (event) {
  var dados = {};
  try { dados = event.data ? event.data.json() : {}; } catch (e) {}
  var titulo = dados.title || '🆕 Novo chamado';
  var opcoes = {
    body: dados.body || 'Novo chamado recebido.',
    tag: dados.tag || ('chamado-' + Date.now()),
    icon: dados.icon,
    data: dados
  };
  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

// Quando o usuário toca na notificação: foca a aba já aberta (ou abre uma nova)
// e avisa a página para abrir o Painel de Chamados.
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if ('focus' in c) {
          c.postMessage({ tipo: 'abrir-painel-chamados' });
          return c.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('./');
      }
    })
  );
});
