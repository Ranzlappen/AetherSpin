import type { Translations } from '../core/i18n';

/**
 * Brazilian Portuguese (pt-BR) UI strings. Partial by design — any key not
 * present here falls back to the English text in `en.ts`.
 *
 * NOTE: machine-drafted for the i18n pipeline; have a native reviewer sign off
 * the copy (esp. responsible-gaming/legal lines) before shipping to a market.
 */
export const pt: Partial<Translations> = {
  'app.initializing': 'Inicializando NovaForged…',
  'app.authenticating': 'Autenticando…',
  'app.startingDemo': 'Iniciando sessão de demonstração local…',
  'app.rendererFailed': 'Falha ao iniciar o renderizador: {message}',

  'error.connect': 'Falha ao conectar ao servidor do jogo.',
  'error.spinFailed': 'O giro falhou.',
  'error.autoplayInsufficient': 'Giro automático interrompido: saldo insuficiente.',
  'error.renderLost': 'Gráficos pausados — restaurando…',

  'hud.balance': 'Saldo',
  'hud.bet': 'Aposta',
  'hud.win': 'Ganho',
  'hud.freeSpins': 'GIROS GRÁTIS',
  'hud.demoBadge': 'DEMO · RGS simulado · {fps} fps',
  'hud.demoTitle': 'Nenhum parâmetro de RGS detectado — executando no RGS simulado local',

  'spin.label': 'Girar',
  'spin.skip': 'Pular',
  'spin.lowBalance': 'Saldo baixo',

  'turbo.label': 'Modo turbo',
  'turbo.on': 'Turbo ativado',
  'turbo.off': 'Turbo desativado',

  'win.big': 'GRANDE PRÊMIO',
  'win.mega': 'MEGA PRÊMIO',
  'win.epic': 'PRÊMIO ÉPICO',
  'win.wincap': 'PRÊMIO MÁXIMO',
  'win.tapToContinue': 'Toque para continuar',

  'bet.decrease': 'Diminuir aposta',
  'bet.increase': 'Aumentar aposta',

  'buyBonus.label': 'Comprar giros grátis',
  'buyBonus.confirmTitle': 'Comprar giros grátis?',
  'buyBonus.confirmBody': 'Compre o bônus por {cost} ({multiplier}× sua aposta).',

  'freeSpins.won': 'Você ganhou {amount}',

  'autoplay.label': 'Giro automático',
  'autoplay.auto': 'Auto',
  'autoplay.start': 'Iniciar giro automático',
  'autoplay.stop': 'Parar giro automático',
  'autoplay.stopShort': 'Parar',
  'autoplay.spins': '{count} giros',
  'autoplay.spinsLegend': 'Número de giros',
  'autoplay.lossLimit': 'Limite de perda',
  'autoplay.singleWinLimit': 'Limite de ganho único',
  'autoplay.stopOnFeature': 'Parar nos giros grátis',
  'autoplay.off': 'Não',
  'autoplay.stoppedLossLimit': 'Giro automático parado: limite de perda atingido.',
  'autoplay.stoppedWinLimit': 'Giro automático parado: limite de ganho atingido.',

  'sound.toggle': 'Ativar/desativar som',

  'paytable.open': 'Tabela de pagamentos',
  'paytable.close': 'Fechar tabela de pagamentos',
  'paytable.title': 'Pagamentos dos símbolos',
  'paytable.subtitle': 'Os valores mostrados são múltiplos da aposta total para uma combinação vencedora.',
  'paytable.symbol': 'Símbolo',
  'paytable.features': 'Recursos',
  'paytable.scrollRegion': 'Detalhes da tabela de pagamentos, rolável',
  'paytable.ofAKind': '{count} iguais',
  'paytable.scatterTitle': 'Scatter — {name}',
  'paytable.scatterBody': 'Paga em qualquer posição. {min}+ ativam os giros grátis.',
  'paytable.freeSpinsTitle': 'Giros grátis',
  'paytable.freeSpinsBody': 'Acerte {min}+ scatters para ganhar {minSpins}–{maxSpins} giros.',
  'paytable.freeSpinsRetrigger': 'Reativações concedem mais giros.',
  'paytable.ladderTitle': 'Escada de multiplicadores',
  'paytable.ladderBody':
    'Ganhos durante os giros grátis elevam o multiplicador global de ×{start} até ×{max}.',
  'paytable.multiplierWildsTitle': 'Curingas multiplicadores',
  'paytable.multiplierWildsBody': 'Nos giros grátis, os curingas carregam multiplicadores de {values}×.',
  'paytable.expandingWildsTitle': 'Curingas expansivos',
  'paytable.expandingWildsBody': 'Nos giros grátis, os curingas podem se expandir e cobrir todo o seu rolo.',
  'paytable.bonusBuyTitle': 'Compra de bônus',
  'paytable.bonusBuyBody': 'Compre giros grátis instantaneamente por {cost}× sua aposta.',
  'paytable.paylines': 'Linhas de pagamento ({count})',
  'paytable.rtpLine': 'RTP teórico: {rtp}% · Ganho máximo: {maxWin}× · Volatilidade: {volatility}',
  'paytable.desc.novaforged':
    'Um caça-níquel de vídeo premium 5×3 com 20 linhas e visual neon-cósmico: curingas multiplicadores, giros grátis ativados por scatters com escada de multiplicadores, curingas expansivos e compra de bônus.',
  'paytable.desc.cosmicways':
    'Um caça-níquel de vídeo 5×3 com 243 formas de ganhar e visual neon-cósmico. Os símbolos pagam em rolos adjacentes a partir da esquerda, com giros grátis ativados por scatters.',
  'paytable.desc.stellarclusters':
    'Um caça-níquel de pagamentos por grupos 5×3 com visual neon-cósmico: grupos conectados de um símbolo (curingas substituem) pagam pelo tamanho, com giros grátis ativados por scatters.',

  'volatility.low': 'Baixa',
  'volatility.medium': 'Média',
  'volatility.high': 'Alta',
  'volatility.veryHigh': 'Muito alta',

  'common.dismiss': 'Dispensar',
  'common.close': 'Fechar',
  'common.confirm': 'Confirmar',
  'common.cancel': 'Cancelar',

  'rg.title': 'Verificação de realidade',
  'rg.sessionTime': 'Você está jogando há {minutes} min.',
  'rg.netWin': 'Resultado líquido desta sessão: +{amount}',
  'rg.netLoss': 'Resultado líquido desta sessão: −{amount}',
  'rg.netEven': 'Resultado líquido desta sessão: {amount}',
  'rg.disclaimer': 'O jogo deve ser um entretenimento, não uma forma de ganhar dinheiro.',
  'rg.help': 'Obter ajuda e definir limites',
  'rg.continue': 'Continuar jogando',
  'rg.quit': 'Fazer uma pausa',
  'rg.ended': 'Sessão encerrada. Você pode fechar esta janela com segurança.',

  'ageGate.title': 'Antes de jogar',
  'ageGate.body': 'Você precisa ter {age} anos ou mais e concordar com os termos para jogar este jogo.',
  'ageGate.confirm': 'Tenho {age} anos ou mais e aceito os termos.',
  'ageGate.enter': 'Entrar no jogo',

  'a11y.spinStart': 'Girando.',
  'a11y.win': 'Você ganhou {amount}.',
  'a11y.noWin': 'Sem ganho.',
  'a11y.featureTriggered': 'Giros grátis ativados! {amount} concedidos.',
  'a11y.wincap': 'Ganho máximo! {amount}.',
};
