/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

// ─── Piper TTS Voice Catalog ────────────────────────────────────────
// All available Wyoming Piper voices, embedded for instant UI rendering.

export interface PiperVoice {
  id: string;
  locale: string;
  speaker: string;
  quality: string;
}

export const LANGUAGE_NAMES: Record<string, string> = {
  ar: 'Arabic', bg: 'Bulgarian', ca: 'Catalan', cs: 'Czech', cy: 'Welsh',
  da: 'Danish', de: 'German', el: 'Greek', en: 'English', es: 'Spanish',
  fa: 'Persian', fi: 'Finnish', fr: 'French', hi: 'Hindi', hu: 'Hungarian',
  id: 'Indonesian', is: 'Icelandic', it: 'Italian', ka: 'Georgian', kk: 'Kazakh',
  lb: 'Luxembourgish', lv: 'Latvian', ml: 'Malayalam', ne: 'Nepali', nl: 'Dutch',
  no: 'Norwegian', pl: 'Polish', pt: 'Portuguese', ro: 'Romanian', ru: 'Russian',
  sk: 'Slovak', sl: 'Slovenian', sr: 'Serbian', sv: 'Swedish', sw: 'Swahili',
  te: 'Telugu', tr: 'Turkish', uk: 'Ukrainian', vi: 'Vietnamese', zh: 'Chinese',
};

function v(id: string): PiperVoice {
  const localeEnd = id.indexOf('-');
  const locale = id.substring(0, localeEnd);
  const rest = id.substring(localeEnd + 1);
  let quality: string;
  let speaker: string;
  if (rest.endsWith('-x_low')) { quality = 'x_low'; speaker = rest.slice(0, -6); }
  else if (rest.endsWith('-low')) { quality = 'low'; speaker = rest.slice(0, -4); }
  else if (rest.endsWith('-medium')) { quality = 'medium'; speaker = rest.slice(0, -7); }
  else if (rest.endsWith('-high')) { quality = 'high'; speaker = rest.slice(0, -5); }
  else { quality = '?'; speaker = rest; }
  return { id, locale, speaker, quality };
}

export const PIPER_VOICES: PiperVoice[] = [
  v('ar_JO-kareem-low'), v('ar_JO-kareem-medium'),
  v('bg_BG-dimitar-medium'),
  v('ca_ES-upc_ona-medium'), v('ca_ES-upc_ona-x_low'), v('ca_ES-upc_pau-x_low'),
  v('cs_CZ-jirka-low'), v('cs_CZ-jirka-medium'),
  v('cy_GB-bu_tts-medium'), v('cy_GB-gwryw_gogleddol-medium'),
  v('da_DK-talesyntese-medium'),
  v('de_DE-eva_k-x_low'), v('de_DE-karlsson-low'), v('de_DE-kerstin-low'),
  v('de_DE-mls-medium'), v('de_DE-pavoque-low'), v('de_DE-ramona-low'),
  v('de_DE-thorsten-high'), v('de_DE-thorsten-low'), v('de_DE-thorsten-medium'),
  v('de_DE-thorsten_emotional-medium'),
  v('el_GR-rapunzelina-low'), v('el_GR-rapunzelina-medium'),
  v('en_GB-alan-low'), v('en_GB-alan-medium'), v('en_GB-alba-medium'),
  v('en_GB-aru-medium'), v('en_GB-cori-high'), v('en_GB-cori-medium'),
  v('en_GB-jenny_dioco-medium'), v('en_GB-northern_english_male-medium'),
  v('en_GB-semaine-medium'), v('en_GB-southern_english_female-low'),
  v('en_GB-vctk-medium'),
  v('en_US-amy-low'), v('en_US-amy-medium'), v('en_US-arctic-medium'),
  v('en_US-bryce-medium'), v('en_US-danny-low'), v('en_US-hfc_female-medium'),
  v('en_US-hfc_male-medium'), v('en_US-joe-medium'), v('en_US-john-medium'),
  v('en_US-kathleen-low'), v('en_US-kristin-medium'), v('en_US-kusal-medium'),
  v('en_US-l2arctic-medium'), v('en_US-lessac-high'), v('en_US-lessac-low'),
  v('en_US-lessac-medium'), v('en_US-libritts-high'), v('en_US-libritts_r-medium'),
  v('en_US-ljspeech-high'), v('en_US-ljspeech-medium'), v('en_US-norman-medium'),
  v('en_US-reza_ibrahim-medium'), v('en_US-ryan-high'), v('en_US-ryan-low'),
  v('en_US-ryan-medium'), v('en_US-sam-medium'),
  v('es_AR-daniela-high'), v('es_ES-carlfm-x_low'), v('es_ES-davefx-medium'),
  v('es_ES-mls_10246-low'), v('es_ES-mls_9972-low'), v('es_ES-sharvard-medium'),
  v('es_MX-ald-medium'), v('es_MX-claude-high'),
  v('fa_IR-amir-medium'), v('fa_IR-ganji-medium'), v('fa_IR-ganji_adabi-medium'),
  v('fa_IR-gyro-medium'), v('fa_IR-reza_ibrahim-medium'),
  v('fi_FI-harri-low'), v('fi_FI-harri-medium'),
  v('fr_FR-gilles-low'), v('fr_FR-mls-medium'), v('fr_FR-mls_1840-low'),
  v('fr_FR-siwis-low'), v('fr_FR-siwis-medium'), v('fr_FR-tom-medium'),
  v('fr_FR-upmc-medium'),
  v('hi_IN-pratham-medium'), v('hi_IN-priyamvada-medium'), v('hi_IN-rohan-medium'),
  v('hu_HU-anna-medium'), v('hu_HU-berta-medium'), v('hu_HU-imre-medium'),
  v('id_ID-news_tts-medium'),
  v('is_IS-bui-medium'), v('is_IS-salka-medium'), v('is_IS-steinn-medium'),
  v('is_IS-ugla-medium'),
  v('it_IT-paola-medium'), v('it_IT-riccardo-x_low'),
  v('ka_GE-natia-medium'),
  v('kk_KZ-iseke-x_low'), v('kk_KZ-issai-high'), v('kk_KZ-raya-x_low'),
  v('lb_LU-marylux-medium'),
  v('lv_LV-aivars-medium'),
  v('ml_IN-arjun-medium'), v('ml_IN-meera-medium'),
  v('ne_NP-chitwan-medium'), v('ne_NP-google-medium'), v('ne_NP-google-x_low'),
  v('nl_BE-nathalie-medium'), v('nl_BE-nathalie-x_low'), v('nl_BE-rdh-medium'),
  v('nl_BE-rdh-x_low'),
  v('nl_NL-mls-medium'), v('nl_NL-mls_5809-low'), v('nl_NL-mls_7432-low'),
  v('nl_NL-pim-medium'), v('nl_NL-ronnie-medium'),
  v('no_NO-nvcc-medium'), v('no_NO-talesyntese-medium'),
  v('pl_PL-darkman-medium'), v('pl_PL-gosia-medium'), v('pl_PL-mc_speech-medium'),
  v('pl_PL-mls_6892-low'),
  v('pt_BR-cadu-medium'), v('pt_BR-edresson-low'), v('pt_BR-faber-medium'),
  v('pt_BR-jeff-medium'),
  v('pt_PT-tugão-medium'),
  v('ro_RO-mihai-medium'),
  v('ru_RU-denis-medium'), v('ru_RU-dmitri-medium'), v('ru_RU-irina-medium'),
  v('ru_RU-ruslan-medium'),
  v('sk_SK-lili-medium'),
  v('sl_SI-artur-medium'),
  v('sr_RS-serbski_institut-medium'),
  v('sv_SE-lisa-medium'), v('sv_SE-nst-medium'),
  v('sw_CD-lanfrica-medium'),
  v('te_IN-maya-medium'), v('te_IN-padmavathi-medium'), v('te_IN-venkatesh-medium'),
  v('tr_TR-dfki-medium'),
  v('uk_UA-lada-x_low'), v('uk_UA-ukrainian_tts-medium'),
  v('vi_VN-25hours_single-low'), v('vi_VN-vais1000-medium'), v('vi_VN-vivos-x_low'),
  v('zh_CN-chaowen-medium'), v('zh_CN-huayan-medium'), v('zh_CN-huayan-x_low'),
  v('zh_CN-xiao_ya-medium'),
];
