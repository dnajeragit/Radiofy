import { state, defaultRadioImage, truncateStationName } from './state.js';
import { actions } from './actions.js';

function getFavoriteKey(station) {
  return `${station && station.name ? station.name : 'radio'}-${station && station.url_resolved ? station.url_resolved : ''}`;
}

function saveFavorites() {
  localStorage.setItem('radiofy-favorites', JSON.stringify(state.favorites.slice(0, 8)));
}

function renderFavoritesList() {
  const container = document.getElementById('favoritesList');
  if (!container) return;

  const favoriteStations = state.favorites.slice(0, 6);
  container.innerHTML = '';

  if (!favoriteStations.length) {
    container.innerHTML = '<div class="favorite-empty">Guarda tus radios favoritas para volver rápido.</div>';
    return;
  }

  favoriteStations.forEach((station) => {
    const item = document.createElement('div');
    item.className = 'favorite-item';
    item.addEventListener('click', () => {
      if (station.url_resolved) {
        actions.play(station.url_resolved, station.name || 'Radio');
      }
    });

    const img = document.createElement('img');
    img.src = actions.getStationImage(station);
    img.alt = station.name || 'Radio';
    img.onerror = () => {
      img.src = defaultRadioImage;
      img.onerror = null;
    };

    const name = document.createElement('span');
    name.className = 'favorite-name';
    const fullName = station.name || 'Radio sin nombre';
    name.textContent = truncateStationName(fullName);
    name.title = fullName;

    const remove = document.createElement('button');
    remove.className = 'favorite-remove';
    remove.textContent = '×';
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      state.favorites = state.favorites.filter(item => getFavoriteKey(item) !== getFavoriteKey(station));
      saveFavorites();
      renderFavoritesList();
    });

    item.appendChild(img);
    item.appendChild(name);
    item.appendChild(remove);
    container.appendChild(item);
  });
}

function toggleFavorite(station) {
  if (!station || !station.name) return;
  const key = getFavoriteKey(station);
  const exists = state.favorites.some(item => getFavoriteKey(item) === key);

  if (exists) {
    state.favorites = state.favorites.filter(item => getFavoriteKey(item) !== key);
  } else {
    state.favorites.unshift({
      name: station.name || 'Radio sin nombre',
      country: station.country || 'Desconocido',
      language: station.language || 'Sin idioma',
      url_resolved: station.url_resolved || '',
      favicon: station.favicon || ''
    });
  }

  saveFavorites();
  renderFavoritesList();
}

export { getFavoriteKey, saveFavorites, renderFavoritesList, toggleFavorite };
