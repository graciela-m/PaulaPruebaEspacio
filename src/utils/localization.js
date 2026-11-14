import spanish from '../data/locales/es.json';
import english from '../data/locales/en.json';

export const LANGUAGE_STORAGE_KEY = 'spaceLegacyLanguage';

const catalogs = { es: spanish, en: english };
const missingTranslations = new Set();

export function getSavedLanguage() {
  try {
    const stored = globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY);
    return stored === 'en' || stored === 'es' ? stored : 'es';
  } catch (error) {
    console.warn('[Localization] No se pudo leer el idioma guardado; se usará español.', error);
    return 'es';
  }
}

export function saveLanguage(language) {
  if (language !== 'es' && language !== 'en') {
    throw new Error(`[Localization] Idioma no compatible: ${language}`);
  }

  try {
    globalThis.localStorage?.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (error) {
    console.warn('[Localization] No se pudo guardar el idioma elegido.', error);
  }
}

function valueAtPath(source, path) {
  return path.split('.').reduce((value, key) => value?.[key], source);
}

function warnMissingTranslation(key) {
  if (missingTranslations.has(key)) return;
  missingTranslations.add(key);
  console.warn(`[Localization] Falta la traducción "${key}"; se usa español.`);
}

export function translate(language, path) {
  const localized = valueAtPath(catalogs[language] ?? catalogs.es, path);
  if (localized !== undefined && localized !== null) return localized;

  const fallback = valueAtPath(catalogs.es, path);
  if (fallback !== undefined && fallback !== null) {
    if (language !== 'es') warnMissingTranslation(path);
    return fallback;
  }

  warnMissingTranslation(path);
  return path;
}

export function localizedField(record, key, language) {
  if (language !== 'es') {
    const translated = record.translations?.[language]?.[key];
    if (translated !== undefined && translated !== null) return translated;
    if (record[key] !== undefined && record[key] !== null) {
      warnMissingTranslation(`${record.id}.${key}`);
      return record[key];
    }
  }

  return record[key];
}

export function localizedAssetCaption(asset, language) {
  const caption = catalogs[language]?.galleryCaptions?.[asset.id];
  if (caption) return caption;
  if (language !== 'es' && asset.title) return asset.title;
  if (language !== 'es' && catalogs.es.galleryCaptions?.[asset.id]) {
    warnMissingTranslation(`assets.${asset.id}.captions.${language}`);
    return catalogs.es.galleryCaptions[asset.id];
  }
  return asset.title ?? '';
}