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
  'spin.lowBalance': 'Saldo bajo',

  'bet.decrease': 'Disminuir apuesta',
  'bet.increase': 'Aumentar apuesta',

  'buyBonus.label': 'Comprar giros gratis',
  'buyBonus.confirmTitle': '¿Comprar giros gratis?',
  'buyBonus.confirmBody': 'Compra el bono por {cost} ({multiplier}× tu apuesta).',

  'freeSpins.won': 'Ganaste {amount}',

  'autoplay.label': 'Giro automático',
  'autoplay.auto': 'Auto',
  'autoplay.start': 'Iniciar giro automático',
  'autoplay.stop': 'Detener giro automático',
  'autoplay.stopShort': 'Detener',
  'autoplay.spins': '{count} giros',

  'sound.toggle': 'Activar/desactivar sonido',

  'paytable.open': 'Tabla de pagos',
  'paytable.close': 'Cerrar tabla de pagos',
  'paytable.title': 'Pagos de símbolos',
  'paytable.subtitle':
    'Los valores mostrados son múltiplos de la apuesta total para una combinación ganadora.',
  'paytable.symbol': 'Símbolo',
  'paytable.features': 'Funciones',
  'paytable.scrollRegion': 'Detalles de la tabla de pagos, desplazable',

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
