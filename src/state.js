export const defaultRadioImage = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240">
        <rect width="400" height="240" fill="#0f172a"/>
        <circle cx="200" cy="90" r="42" fill="#2563eb"/>
        <circle cx="200" cy="90" r="18" fill="#0b1220"/>
        <rect x="145" y="138" width="110" height="14" rx="7" fill="#60a5fa" opacity="0.9"/>
        <rect x="118" y="166" width="164" height="12" rx="6" fill="#334155"/>
      </svg>
    `);

export const REGION_BY_COUNTRY = {
      'Argentina': 'Sudamérica',
      'Brasil': 'Sudamérica',
      'Chile': 'Sudamérica',
      'Colombia': 'Sudamérica',
      'Ecuador': 'Sudamérica',
      'Perú': 'Sudamérica',
      'Uruguay': 'Sudamérica',
      'United States': 'Norteamérica',
      'Canada': 'Norteamérica',
      'Mexico': 'Norteamérica',
      'Spain': 'Europa',
      'Germany': 'Europa',
      'France': 'Europa',
      'Italy': 'Europa',
      'Portugal': 'Europa',
      'United Kingdom': 'Europa',
      'Japan': 'Asia',
      'India': 'Asia',
      'South Korea': 'Asia',
      'China': 'Asia',
      'Indonesia': 'Asia',
      'South Africa': 'África',
      'Nigeria': 'África',
      'Morocco': 'África',
      'Kenya': 'África'
    };

export const COUNTRY_ALIASES = {
      'CL': 'Chile', 'AR': 'Argentina', 'BR': 'Brasil', 'PE': 'Perú', 'CO': 'Colombia',
      'UY': 'Uruguay', 'EC': 'Ecuador', 'US': 'United States', 'CA': 'Canada', 'MX': 'Mexico',
      'ES': 'Spain', 'DE': 'Germany', 'FR': 'France', 'IT': 'Italy', 'PT': 'Portugal', 'GB': 'United Kingdom',
      'JP': 'Japan', 'IN': 'India', 'KR': 'South Korea', 'CN': 'China', 'ID': 'Indonesia',
      'ZA': 'South Africa', 'NG': 'Nigeria', 'MA': 'Morocco', 'KE': 'Kenya'
    };

export const PAGE_SIZE = 18;
export const SCHEDULE_STORAGE_KEY = 'radiofy-schedules';
export const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const WEEKDAY_NAMES_CAPITALIZED = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const POPULAR_GENRES = ['Rock', 'Jazz', 'Pop', 'Electrónica', 'Classic Rock', 'Metal', 'Hip-Hop', 'Latin', 'Salsa', 'Cumbia', 'Reggae', 'Funk', 'Soul', 'Blues'];

export function truncateStationName(name) {
  const characters = Array.from(name);
  return characters.length > 45 ? `${characters.slice(0, 42).join('')}...` : name;
}

export const state = {
  COUNTRY_BY_REGION: {},
  COUNTRY_REGIONS: {},
  activeFilter: { type: 'search', value: '' },
  allStations: [],
  visibleCount: 0,
  loadingMore: false,
  allCountries: [],
  currentStation: null,
  radioHistory: [],
  favorites: [],
  radioSchedules: [],
  scheduleStation: null,
  selectedScheduleDay: new Date().getDay(),
  navigationState: { continent: null, country: null, region: null }
};
