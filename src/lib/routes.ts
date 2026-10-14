import { defaultLocale, locales, type Locale, type Localized } from './i18n';

export const localeRoutePrefixes: Localized<string> = {
  'zh-CN': '/zh-cn',
  'zh-TW': '/zh-tw',
  en: '/en',
};

export const routeLocaleParams = {
  'zh-cn': 'zh-CN',
  'zh-tw': 'zh-TW',
  en: 'en',
} as const satisfies Record<string, Locale>;

export type RouteLocaleParam = keyof typeof routeLocaleParams;

const splitPathSuffix = (value: string) => {
  const suffixIndex = value.search(/[?#]/);
  return suffixIndex < 0
    ? { pathname: value, suffix: '' }
    : { pathname: value.slice(0, suffixIndex), suffix: value.slice(suffixIndex) };
};

const normalizePathname = (value: string) => {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash === '' ? '/' : withLeadingSlash;
};

export const localeFromRouteParam = (value: string | undefined): Locale => (
  value && value in routeLocaleParams
    ? routeLocaleParams[value as RouteLocaleParam]
    : defaultLocale
);

export const localeFromPathname = (pathname: string): Locale => {
  if (pathname === '/zh-cn' || pathname.startsWith('/zh-cn/')) return 'zh-CN';
  if (pathname === '/zh-tw' || pathname.startsWith('/zh-tw/')) return 'zh-TW';
  if (pathname === '/en' || pathname.startsWith('/en/')) return 'en';
  return defaultLocale;
};

export const logicalPathname = (pathname: string) => {
  const normalized = normalizePathname(pathname);
  const prefix = Object.values(localeRoutePrefixes).find((candidate) => (
    normalized === candidate || normalized.startsWith(`${candidate}/`)
  ));
  if (!prefix) return normalized;
  const logical = normalized.slice(prefix.length);
  return normalizePathname(logical || '/');
};

export const localizedPath = (locale: Locale, value: string) => {
  const { pathname, suffix } = splitPathSuffix(value);
  const logical = logicalPathname(normalizePathname(pathname));
  const prefix = localeRoutePrefixes[locale];
  const localized = prefix ? `${prefix}${logical === '/' ? '/' : logical}` : logical;
  return `${localized}${suffix}`;
};

export const localizedAbsoluteUrls = (pathname: string, site: URL): Localized<string> => {
  const logical = logicalPathname(pathname);
  return Object.fromEntries(locales.map((locale) => [
    locale,
    new URL(localizedPath(locale, logical), site).href,
  ])) as Localized<string>;
};

export const openGraphLocales: Localized<string> = {
  'zh-CN': 'zh_CN',
  'zh-TW': 'zh_TW',
  en: 'en_US',
};
