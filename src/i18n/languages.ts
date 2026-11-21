const languages = [
  { value: 'en', label: '🇬🇧 English' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'pt', label: '🇧🇷 Português' },
  { value: 'ja', label: '🇯🇵 日本語' },
  { value: 'zh', label: '🇨🇳 中文' },
];

export function languageOptions(unavailable: string) {
  return languages.map((language) => {
    const disabled = language.value !== 'en' && language.value !== 'es';
    return { ...language, disabled, label: disabled ? `${language.label} — ${unavailable}` : language.label };
  });
}
