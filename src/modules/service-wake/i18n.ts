export const serviceWakeMessages = {
  en: {
    'serviceWake.unknown': 'Unknown service.', 'serviceWake.startError': 'The service could not start.',
    'serviceWake.stopped': '{service} is stopped', 'serviceWake.loginHint': 'Sign in to the dashboard to start it.',
    'serviceWake.signIn': 'Sign in', 'serviceWake.checking': 'Checking {service}…',
    'serviceWake.inactive': 'This service is not active right now. Start it to open it.',
    'serviceWake.activate': 'Start {service}', 'serviceWake.starting': 'Starting {service}…',
    'serviceWake.waitTime': 'This may take about {duration}. We’ll take you there as soon as it is ready.',
    'serviceWake.ready': '{service} is ready', 'serviceWake.redirecting': 'Redirecting…',
    'serviceWake.activateError': 'Could not start the service', 'serviceWake.retry': 'Retry',
  },
  es: {
    'serviceWake.unknown': 'Servicio desconocido.', 'serviceWake.startError': 'El servicio no pudo arrancar.',
    'serviceWake.stopped': '{service} está detenido', 'serviceWake.loginHint': 'Inicia sesión en el panel para activarlo.',
    'serviceWake.signIn': 'Iniciar sesión', 'serviceWake.checking': 'Comprobando {service}…',
    'serviceWake.inactive': 'Este servicio no está activo ahora mismo. Actívalo para abrirlo.',
    'serviceWake.activate': 'Activar {service}', 'serviceWake.starting': 'Iniciando {service}…',
    'serviceWake.waitTime': 'Puede tardar unos {duration}. Te llevaré allí en cuanto esté listo.',
    'serviceWake.ready': '{service} está listo', 'serviceWake.redirecting': 'Redirigiendo…',
    'serviceWake.activateError': 'No se pudo activar el servicio', 'serviceWake.retry': 'Reintentar',
  },
} as const;
