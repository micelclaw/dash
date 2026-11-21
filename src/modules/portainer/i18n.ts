export const portainerMessages = {
  en: {
    'portainer.statusError': 'Failed to check Portainer status', 'portainer.startError': 'Failed to start Portainer',
    'portainer.dockerManagement': 'Docker management', 'portainer.uptime': 'Up: {duration}',
    'portainer.frameTitle': 'Portainer Docker management', 'portainer.checking': 'Checking Portainer status…',
    'portainer.settingUp': 'Setting up Portainer…', 'portainer.firstLaunch': 'This may take a moment on first launch',
    'portainer.connectionError': 'Error connecting to Portainer', 'portainer.retry': 'Retry',
  },
  es: {
    'portainer.statusError': 'No se pudo consultar el estado de Portainer', 'portainer.startError': 'No se pudo iniciar Portainer',
    'portainer.dockerManagement': 'Gestión de Docker', 'portainer.uptime': 'Activo: {duration}',
    'portainer.frameTitle': 'Gestión de Docker con Portainer', 'portainer.checking': 'Comprobando el estado de Portainer…',
    'portainer.settingUp': 'Preparando Portainer…', 'portainer.firstLaunch': 'La primera vez puede tardar un momento',
    'portainer.connectionError': 'Error al conectar con Portainer', 'portainer.retry': 'Reintentar',
  },
} as const;
