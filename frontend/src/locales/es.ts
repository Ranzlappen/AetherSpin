import type { Translations } from '../core/i18n';

/**
 * Spanish UI strings (neutral / Latin-American-friendly). Partial by design —
 * any key not present here falls back to the English text in `en.ts`.
 *
 * NOTE: machine-drafted for the i18n pipeline; have a native reviewer sign off
 * the copy (esp. responsible-gaming/legal lines) before shipping to a market.
 */
export const es: Partial<Translations> = {
  'app.initializing': 'Inicializando NovaForged…',
  'app.authenticating': 'Autenticando…',
  'app.startingDemo': 'Iniciando sesión de demostración local…',
  'app.rendererFailed': 'No se pudo iniciar el renderizador: {message}',

  'error.connect': 'No se pudo conectar al servidor del juego.',
  'error.noSession': 'No hay sesión de juego. Inicia el juego desde tu operador.',
  'error.spinFailed': 'El giro falló.',
  'error.autoplayInsufficient': 'Giro automático detenido: saldo insuficiente.',
  'error.renderLost': 'Gráficos en pausa — restaurando…',

  'hud.balance': 'Saldo',
  'hud.bet': 'Apuesta',
  'hud.win': 'Ganancia',
  'hud.freeSpins': 'GIROS GRATIS',
  'hud.demoBadge': 'DEMO · RGS simulado · {fps} fps',
  'hud.demoTitle': 'No se detectaron parámetros de RGS — ejecutando en el RGS simulado local',

  'spin.label': 'Girar',
  'spin.skip': 'Saltar',
  'spin.lowBalance': 'Saldo bajo',

  'turbo.label': 'Modo turbo',
  'turbo.on': 'Turbo activado',
  'turbo.off': 'Turbo desactivado',

  'win.big': 'GRAN PREMIO',
  'win.mega': 'MEGA PREMIO',
  'win.epic': 'PREMIO ÉPICO',
  'win.wincap': 'PREMIO MÁXIMO',
  'win.tapToContinue': 'Toca para continuar',

  'bet.decrease': 'Disminuir apuesta',
  'bet.increase': 'Aumentar apuesta',

  'buyBonus.label': 'Comprar giros gratis',
  'buyBonus.confirmTitle': '¿Comprar giros gratis?',
  'buyBonus.confirmBody': 'Compra el bono por {cost} ({multiplier}× tu apuesta).',
  'buyBonus.featSpins': 'Otorga {min}–{max} giros gratis',
  'buyBonus.featLadder': 'El multiplicador de ganancias sube hasta ×{max}',
  'buyBonus.featWilds': 'Comodines multiplicadores y expansivos',

  'freeSpins.won': 'Ganaste {amount}',
  'freeSpins.awarded': '{count} giros gratis',
  'freeSpins.totalWin': 'Ganancia total',

  'autoplay.label': 'Giro automático',
  'autoplay.auto': 'Auto',
  'autoplay.start': 'Iniciar giro automático',
  'autoplay.stop': 'Detener giro automático',
  'autoplay.stopShort': 'Detener',
  'autoplay.spins': '{count} giros',
  'autoplay.spinsLegend': 'Número de giros',
  'autoplay.lossLimit': 'Límite de pérdida',
  'autoplay.singleWinLimit': 'Límite de ganancia única',
  'autoplay.stopOnFeature': 'Detener con giros gratis',
  'autoplay.off': 'No',
  'autoplay.stoppedLossLimit': 'Giro automático detenido: límite de pérdida alcanzado.',
  'autoplay.stoppedWinLimit': 'Giro automático detenido: límite de ganancia alcanzado.',

  'sound.toggle': 'Activar/desactivar sonido',

  'paytable.open': 'Tabla de pagos',
  'paytable.close': 'Cerrar tabla de pagos',
  'paytable.title': 'Pagos de símbolos',
  'paytable.subtitle':
    'Los valores mostrados son múltiplos de la apuesta total para una combinación ganadora.',
  'paytable.symbol': 'Símbolo',
  'paytable.features': 'Funciones',
  'paytable.scrollRegion': 'Detalles de la tabla de pagos, desplazable',
  'paytable.ofAKind': '{count} iguales',
  'paytable.scatterTitle': 'Scatter — {name}',
  'paytable.scatterBody': 'Paga en cualquier posición. {min}+ activan los giros gratis.',
  'paytable.freeSpinsTitle': 'Giros gratis',
  'paytable.freeSpinsBody': 'Consigue {min}+ scatters para ganar {minSpins}–{maxSpins} giros.',
  'paytable.freeSpinsRetrigger': 'Las reactivaciones otorgan más giros.',
  'paytable.ladderTitle': 'Escalera de multiplicadores',
  'paytable.ladderBody':
    'Las ganancias durante los giros gratis suben el multiplicador global de ×{start} hasta ×{max}.',
  'paytable.multiplierWildsTitle': 'Comodines multiplicadores',
  'paytable.multiplierWildsBody': 'En los giros gratis, los comodines llevan multiplicadores de {values}×.',
  'paytable.expandingWildsTitle': 'Comodines expansivos',
  'paytable.expandingWildsBody':
    'En los giros gratis, los comodines pueden expandirse y cubrir todo su rodillo.',
  'paytable.bonusBuyTitle': 'Compra de bono',
  'paytable.bonusBuyBody': 'Compra giros gratis al instante por {cost}× tu apuesta.',
  'paytable.paylines': 'Líneas de pago ({count})',
  'paytable.rtpLine': 'RTP teórico: {rtp}% · Ganancia máxima: {maxWin}× · Volatilidad: {volatility}',
  'paytable.desc.novaforged':
    'Una tragamonedas de video premium de 5×3 con 20 líneas y estética neón-cósmica: comodines multiplicadores, giros gratis activados por scatters con escalera de multiplicadores, comodines expansivos y compra de bono.',
  'paytable.desc.cosmicways':
    'Una tragamonedas de video de 5×3 con 243 formas de ganar y estética neón-cósmica. Los símbolos pagan en rodillos adyacentes desde la izquierda, con giros gratis activados por scatters.',
  'paytable.desc.stellarclusters':
    'Una tragamonedas de pagos por grupos de 5×3 con estética neón-cósmica: los grupos conectados de un símbolo (los comodines sustituyen) pagan según su tamaño, con giros gratis activados por scatters.',

  'volatility.low': 'Baja',
  'volatility.medium': 'Media',
  'volatility.high': 'Alta',
  'volatility.veryHigh': 'Muy alta',

  'common.dismiss': 'Descartar',
  'common.close': 'Cerrar',
  'common.confirm': 'Confirmar',
  'common.cancel': 'Cancelar',

  'rg.title': 'Control de realidad',
  'rg.sessionTime': 'Llevas jugando {minutes} min.',
  'rg.netWin': 'Resultado neto de esta sesión: +{amount}',
  'rg.netLoss': 'Resultado neto de esta sesión: −{amount}',
  'rg.netEven': 'Resultado neto de esta sesión: {amount}',
  'rg.disclaimer': 'El juego debe ser un entretenimiento, no una forma de ganar dinero.',
  'rg.help': 'Obtener ayuda y establecer límites',
  'rg.continue': 'Seguir jugando',
  'rg.quit': 'Tomar un descanso',
  'rg.ended': 'Sesión finalizada. Puedes cerrar esta ventana de forma segura.',

  'ageGate.title': 'Antes de jugar',
  'ageGate.body': 'Debes tener {age} años o más y aceptar los términos para jugar a este juego.',
  'ageGate.confirm': 'Tengo {age} años o más y acepto los términos.',
  'ageGate.enter': 'Entrar al juego',

  'a11y.spinStart': 'Girando.',
  'a11y.win': 'Ganaste {amount}.',
  'a11y.noWin': 'Sin ganancia.',
  'a11y.featureTriggered': '¡Giros gratis activados! {amount} otorgados.',
  'a11y.wincap': '¡Ganancia máxima! {amount}.',
};
