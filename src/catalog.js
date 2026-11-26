import { state, REGION_BY_COUNTRY, COUNTRY_ALIASES, POPULAR_GENRES, PAGE_SIZE, defaultRadioImage, truncateStationName } from './state.js';
import { actions } from './actions.js';

function getOptionsForState() {
  if (state.navigationState.region && state.COUNTRY_REGIONS[state.navigationState.country]) {
    return state.COUNTRY_REGIONS[state.navigationState.country];
  }

  if (state.navigationState.country) {
    return state.COUNTRY_REGIONS[state.navigationState.country] || [];
  }

  if (state.navigationState.continent) {
    return state.COUNTRY_BY_REGION[state.navigationState.continent] || [];
  }

  if (state.activeFilter.type === 'tag') {
    return POPULAR_GENRES;
  }

  if (state.activeFilter.type === 'language') {
    return ['Spanish', 'English', 'French', 'German', 'Italian'];
  }

  return Object.keys(state.COUNTRY_BY_REGION);
}

function panelLabel() {
  if (state.activeFilter.type === 'tag') return 'Género';
  if (state.activeFilter.type === 'language') return 'Idioma';
  if (state.activeFilter.type === 'country') return 'País';
  return 'Región';
}

function renderCountryPanel() {
  const panel = document.getElementById('countryPanel');
  const showPanel = state.activeFilter.type === 'region' || state.activeFilter.type === 'country' || state.activeFilter.type === 'tag' || state.activeFilter.type === 'language' || state.navigationState.continent || state.navigationState.country || state.navigationState.region;

  if (!showPanel) {
    panel.style.display = 'none';
    panel.innerHTML = '';
    return;
  }

  panel.style.display = 'block';
  panel.innerHTML = '';

  const crumbs = document.createElement('div');
  crumbs.className = 'crumbs';

  const addCrumb = (label, target) => {
    const item = document.createElement('button');
    item.className = 'crumb active';
    item.textContent = label;
    item.addEventListener('click', () => {
      if (target === 'root') {
        state.navigationState.continent = null;
        state.navigationState.country = null;
        state.navigationState.region = null;
        state.activeFilter = { type: 'region', value: '' };
      } else if (target === 'continent') {
        state.navigationState.country = null;
        state.navigationState.region = null;
        state.activeFilter = { type: 'region', value: state.navigationState.continent };
      } else if (target === 'country') {
        state.navigationState.region = null;
        state.activeFilter = { type: 'country', value: state.navigationState.country };
      }

      renderCountryPanel();
      ejecutarFiltroActual();
    });
    crumbs.appendChild(item);
  };

  addCrumb(panelLabel(), 'root');

  if (state.navigationState.continent) {
    addCrumb(state.navigationState.continent, 'continent');
  }

  if (state.navigationState.country) {
    addCrumb(state.navigationState.country, 'country');
  }

  if (state.navigationState.region) {
    addCrumb(state.navigationState.region, 'region');
  }

  panel.appendChild(crumbs);

  const options = getOptionsForState();
  const optionsBox = document.createElement('div');
  optionsBox.className = 'country-grid';

  if (!options.length) {
    panel.innerHTML = '';
    panel.style.display = 'none';
    return;
  }

  options.forEach(option => {
    const button = document.createElement('button');
    button.className = 'region-chip';
    button.textContent = option;
    button.addEventListener('click', () => {
      if (state.activeFilter.type === 'tag') {
        state.activeFilter = { type: 'tag', value: option.toLowerCase() };
        document.getElementById('query').value = option;
        buscar();
        return;
      }

      if (state.activeFilter.type === 'language') {
        state.activeFilter = { type: 'language', value: option };
        document.getElementById('query').value = option;
        buscar();
        return;
      }

      if (!state.navigationState.continent) {
        state.navigationState.continent = option;
        state.navigationState.country = null;
        state.navigationState.region = null;
        state.activeFilter = { type: 'region', value: option };
      } else if (!state.navigationState.country) {
        state.navigationState.country = option;
        state.navigationState.region = null;
        state.activeFilter = { type: 'country', value: option };
      } else {
        state.navigationState.region = option;
        state.activeFilter = { type: 'region', value: option };
      }

      renderCountryPanel();
      ejecutarFiltroActual();
    });
    optionsBox.appendChild(button);
  });

  panel.appendChild(optionsBox);
}

function buildRegionIndexByCountry(countries) {
  const byRegion = {};
  countries.forEach(country => {
    const name = country.name || country; 
    if (!name) return;

    const region = REGION_BY_COUNTRY[name] || 'Otro';
    if (!byRegion[region]) {
      byRegion[region] = [];
    }

    if (!byRegion[region].includes(name)) {
      byRegion[region].push(name);
    }
  });

  Object.keys(byRegion).forEach(region => {
    byRegion[region].sort((a, b) => a.localeCompare(b));
  });

  Object.assign(state.COUNTRY_BY_REGION, byRegion);

  Object.keys(byRegion).forEach(region => {
    byRegion[region].forEach(country => {
      state.COUNTRY_REGIONS[country] = ['Norte', 'Centro', 'Sur'];
    });
  });
}

async function loadCountries() {
  try {
    const res = await fetch('https://de1.api.radio-browser.info/json/countries');
    if (!res.ok) throw new Error('Error cargando países');

    const data = await res.json();
    if (!Array.isArray(data)) return;

    const uniqueCountries = [...new Set(data.map(item => item.name || item.country || item).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));

    state.allCountries = uniqueCountries;
    buildRegionIndexByCountry(uniqueCountries);
  } catch (error) {
    state.allCountries = Object.keys(REGION_BY_COUNTRY).sort((a, b) => a.localeCompare(b));
    buildRegionIndexByCountry(state.allCountries);
  }
}

function detectUserCountry() {
  const locale = (navigator.languages && navigator.languages[0]) || navigator.language || '';
  const region = new Intl.Locale(locale).region || locale.split('-')[1] || '';
  return COUNTRY_ALIASES[region.toUpperCase()] || null;
}

async function buscarRegion(region) {
  const regionCountries = state.COUNTRY_BY_REGION[region] || [];
  if (!regionCountries.length) return;

  try {
    const results = await Promise.all(
      regionCountries.map(async (country) => {
        const response = await fetch(`https://de1.api.radio-browser.info/json/stations/bycountry/${encodeURIComponent(country)}`);
        if (!response.ok) return [];
        return response.json();
      })
    );

    const merged = Array.from(
      new Map(
        results.flat().map(item => [`${item.name || ''}-${item.url_resolved || ''}`, item])
      ).values()
    );

    state.allStations = merged;
    state.visibleCount = Math.min(PAGE_SIZE, state.allStations.length);
    renderStationsChunk();
  } catch (error) {
    state.allStations = [];
    state.visibleCount = 0;
    document.getElementById('results').innerHTML = '<div class="empty-state">No se pudieron cargar las radios de esa región.</div>';
  }
}

function normalizeMediaUrl(value) {
  if (typeof value !== 'string') return '';
  const clean = value.trim();
  if (!clean || clean === 'null' || clean === 'undefined' || clean === 'about:blank') {
    return '';
  }
  return clean;
}

function renderStationsChunk() {
  const container = document.getElementById('results');
  const nextItems = state.allStations.slice(0, state.visibleCount);

  container.innerHTML = '';

  if (!nextItems.length) {
    container.innerHTML = '<div class="empty-state">No se encontraron radios para esta búsqueda.</div>';
    return;
  }

  nextItems.forEach(station => {
    const card = document.createElement('div');
    card.className = 'card';

    const img = document.createElement('img');
    img.src = getStationImage(station);
    img.alt = station.name || 'Radio';
    img.onerror = () => {
      img.src = defaultRadioImage;
      img.onerror = null;
    };

    const name = document.createElement('h3');
    const fullName = station.name || 'Radio sin nombre';
    name.textContent = truncateStationName(fullName);
    name.title = fullName;

    const meta = document.createElement('p');
    meta.textContent = `${station.country || 'Desconocido'} - ${station.language || 'Sin idioma'}`;

    const button = document.createElement('button');
    button.innerHTML = '<span aria-hidden="true">▶</span> Play';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.gap = '8px';
    button.addEventListener('click', () => actions.play(station.url_resolved || '', station.name || 'Radio'));

    const favoriteToggle = document.createElement('button');
    const isFavorite = state.favorites.some(item => actions.getFavoriteKey(item) === actions.getFavoriteKey(station));
    favoriteToggle.textContent = isFavorite ? '★' : '☆';
    favoriteToggle.title = isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos';
    favoriteToggle.className = 'favorite-toggle';
    favoriteToggle.type = 'button';
    favoriteToggle.setAttribute('aria-label', isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos');
    favoriteToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      actions.toggleFavorite(station);
      const nextIsFavorite = state.favorites.some(item => actions.getFavoriteKey(item) === actions.getFavoriteKey(station));
      favoriteToggle.textContent = nextIsFavorite ? '★' : '☆';
      favoriteToggle.title = nextIsFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos';
      favoriteToggle.setAttribute('aria-label', nextIsFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos');
    });

    const scheduleButton = document.createElement('button');
    scheduleButton.className = 'schedule-station-button';
    scheduleButton.type = 'button';
    scheduleButton.textContent = 'Programar';
    scheduleButton.addEventListener('click', () => actions.openScheduleDrawer(station));

    const cardActions = document.createElement('div');
    cardActions.className = 'card-actions';
    cardActions.appendChild(favoriteToggle);
    cardActions.appendChild(scheduleButton);

    card.appendChild(img);
    card.appendChild(name);
    card.appendChild(meta);
    card.appendChild(button);
    card.appendChild(cardActions);
    container.appendChild(card);
  });

  if (state.visibleCount < state.allStations.length) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'load-more';
    more.textContent = 'Toca aquí para cargar más radios';
    more.addEventListener('click', loadMoreStations);
    container.appendChild(more);
  }
}

function loadMoreStations() {
  if (state.loadingMore || state.visibleCount >= state.allStations.length) return;

  state.loadingMore = true;
  state.visibleCount += PAGE_SIZE;
  renderStationsChunk();
  state.loadingMore = false;
}

function getStationImage(station) {
  const safeFavicon = normalizeMediaUrl(station && station.favicon);
  return safeFavicon || defaultRadioImage;
}

function getEndpoint({ query, type, value }) {
  const q = (query || '').trim();
  const filterType = type || 'search';
  const filterValue = (value || '').trim();

  if (filterType === 'country' && filterValue) {
    if (!q || q.toLocaleLowerCase() === filterValue.toLocaleLowerCase()) {
      return `https://de1.api.radio-browser.info/json/stations/bycountry/${encodeURIComponent(filterValue)}`;
    }

    return `https://de1.api.radio-browser.info/json/stations/search?country=${encodeURIComponent(filterValue)}&name=${encodeURIComponent(q)}`;
  }

  if (q) {
    return `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(q)}`;
  }

  if (filterType === 'language' && filterValue) {
    return `https://de1.api.radio-browser.info/json/stations/bylanguage/${encodeURIComponent(filterValue)}`;
  }

  if (filterType === 'tag' && filterValue) {
    return `https://de1.api.radio-browser.info/json/stations/bytag/${encodeURIComponent(filterValue)}`;
  }

  return 'https://de1.api.radio-browser.info/json/stations/search?name=radio';
}

function ejecutarFiltroActual() {
  if (state.navigationState.country) {
    state.activeFilter = { type: 'country', value: state.navigationState.country };
    document.getElementById('query').value = state.navigationState.country;
    buscar();
    return;
  }

  if (state.navigationState.continent) {
    state.activeFilter = { type: 'region', value: state.navigationState.continent };
    document.getElementById('query').value = state.navigationState.continent;
    buscarRegion(state.navigationState.continent);
    return;
  }

  state.activeFilter = { type: 'search', value: '' };
  document.getElementById('query').value = '';
  buscar();
}

async function buscar() {
  const q = (document.getElementById('query').value || '').trim();

  if (!q && state.activeFilter.type === 'region' && state.activeFilter.value) {
    await buscarRegion(state.activeFilter.value);
    return;
  }

  const url = getEndpoint({
    query: q,
    type: state.activeFilter.type,
    value: state.activeFilter.value
  });

  const container = document.getElementById('results');
  container.innerHTML = '<div class="empty-state">Buscando radios...</div>';

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error('Error en la API');
    }
    const data = await res.json();

    state.allStations = Array.isArray(data) ? data : [];
    state.visibleCount = Math.min(PAGE_SIZE, state.allStations.length);
    renderStationsChunk();
  } catch (error) {
    state.allStations = [];
    state.visibleCount = 0;
    container.innerHTML = '<div class="empty-state">No se pudo cargar la búsqueda. Revisa la conexión o el término.</div>';
  }
}

export { getOptionsForState, panelLabel, renderCountryPanel, buildRegionIndexByCountry, loadCountries, detectUserCountry, buscarRegion, normalizeMediaUrl, renderStationsChunk, loadMoreStations, getStationImage, getEndpoint, ejecutarFiltroActual, buscar };
