// sw-notif.js — Service Worker exclusivo para exibir notificações locais
// (novos chamados e ligações) no CSSL Central TI. Necessário porque no
// Android/mobile o navegador não permite "new Notification(...)" fora de um
// Service Worker. Não faz cache nem intercepta requisições — só cuida de
// notificações.

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

// Recebe o push de verdade mandado pela Edge Function do Supabase (funciona
// mesmo com o app/aba fechados, não só em segundo plano).
// ALTERADO: agora também trata push de LIGAÇÃO (tipo "chamada", mandado pela
// Edge Function send-chamada-push) diferente de push de "chamado novo" —
// ligação vibra, tenta continuar visível até a pessoa interagir, e guarda o
// e-mail de quem ligou em notification.data pra usar no clique.
self.addEventListener('push', function (event) {
  var dados = {};
  try { dados = event.data ? event.data.json() : {}; } catch (e) {}
  var ehChamada = !!(dados.data && dados.data.tipo === 'chamada');
  var titulo = dados.title || (ehChamada ? '📞 Ligação recebida' : '🆕 Novo chamado');
  var opcoes = {
    body: dados.body || (ehChamada ? 'Alguém está te ligando.' : 'Novo chamado recebido.'),
    tag: dados.tag || ((ehChamada ? 'chamada-' : 'chamado-') + Date.now()),
    icon: dados.icon,
    data: dados.data || dados
  };
  if (ehChamada) {
    // ADIÇÃO: chamada merece mais destaque — vibra e tenta ficar na tela até
    // a pessoa tocar (nem todo navegador respeita requireInteraction, mas
    // não atrapalha nos que não respeitam).
    opcoes.vibrate = [300, 150, 300, 150, 300];
    opcoes.requireInteraction = true;
  }
  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

// Quando o usuário toca na notificação: foca a aba já aberta (ou abre uma
// nova) e avisa a página o que fazer — abrir o Painel de Chamados (chamado
// novo) ou ir direto pra conversa de quem ligou (ligação).
// ALTERADO: agora distingue os dois casos usando notification.data.tipo.
self.addEventListener('notificationclick', function (event) {
  var dados = event.notification.data || {};
  var ehChamada = dados.tipo === 'chamada';
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      var mensagem = ehChamada
        ? { tipo: 'chamada-recebida', deEmail: dados.deEmail || '' }
        : { tipo: 'abrir-painel-chamados' };
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if ('focus' in c) {
          c.postMessage(mensagem);
          return c.focus();
        }
      }
      if (self.clients.openWindow) {
        // ADIÇÃO: quando não há nenhuma aba aberta, abre uma nova e manda a
        // mesma mensagem assim que ela terminar de carregar — a página já
        // fica esperando por essa mensagem desde o início (ver index.html).
        return self.clients.openWindow('./').then(function (janela) {
          if (janela && janela.postMessage) {
            setTimeout(function () { janela.postMessage(mensagem); }, 1500);
          }
          return janela;
        });
      }
    })
  );
});
