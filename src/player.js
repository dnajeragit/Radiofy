import { state, defaultRadioImage } from './state.js';
import { actions } from './actions.js';

function renderSelectedStationCard() {
  const container = document.getElementById('selectedStationCard');
  const panel = document.getElementById('selectedStationPanel');
  if (!container || !panel) return;

  if (!state.currentStation) {
    panel.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  panel.style.display = 'block';

  const img = document.createElement('img');
  img.src = actions.getStationImage(state.currentStation);
  img.alt = state.currentStation.name || 'Radio';
  img.onerror = () => {
    img.src = defaultRadioImage;
    img.onerror = null;
  };

  const title = document.createElement('h3');
  title.textContent = state.currentStation.name || 'Radio sin nombre';

  const meta = document.createElement('p');
  meta.textContent = `${state.currentStation.country || 'Desconocido'} • ${state.currentStation.language || 'Sin idioma'}`;

  const actionButtons = document.createElement('div');
  actionButtons.className = 'now-playing-actions';

  const favoriteButton = document.createElement('button');
  const isFavorite = state.favorites.some(item => actions.getFavoriteKey(item) === actions.getFavoriteKey(state.currentStation));
  favoriteButton.type = 'button';
  favoriteButton.textContent = isFavorite ? '★ Favorito' : '☆ Favorito';
  favoriteButton.setAttribute('aria-label', isFavorite ? 'Quitar radio de favoritos' : 'Agregar radio a favoritos');
  favoriteButton.addEventListener('click', () => {
    actions.toggleFavorite(state.currentStation);
    renderSelectedStationCard();
  });

  const scheduleButton = document.createElement('button');
  scheduleButton.className = 'now-playing-schedule';
  scheduleButton.type = 'button';
  scheduleButton.textContent = 'Programar';
  scheduleButton.addEventListener('click', () => actions.openScheduleDrawer(state.currentStation));

  actionButtons.appendChild(favoriteButton);
  actionButtons.appendChild(scheduleButton);

  container.innerHTML = '';
  container.appendChild(img);
  container.appendChild(title);
  container.appendChild(meta);
  container.appendChild(actionButtons);
}

function renderHistoryList() {
  const historyList = document.getElementById('historyList');
  const panel = document.getElementById('historyPanel');
  if (!historyList || !panel) return;

  historyList.innerHTML = '';

  if (!state.radioHistory.length) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';

  state.radioHistory.forEach((station, index) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.addEventListener('click', () => {
      if (station.url_resolved) {
        play(station.url_resolved, station.name || 'Radio');
      }
    });

    const img = document.createElement('img');
    img.src = actions.getStationImage(station);
    img.alt = station.name || 'Radio';
    img.onerror = () => {
      img.src = defaultRadioImage;
      img.onerror = null;
    };

    const copy = document.createElement('div');
    copy.className = 'history-copy';
    const name = document.createElement('strong');
    name.textContent = station.name || 'Radio sin nombre';
    const meta = document.createElement('span');
    meta.textContent = station.country || 'Desconocido';
    copy.appendChild(name);
    copy.appendChild(meta);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-history';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      state.radioHistory.splice(index, 1);
      renderHistoryList();
    });

    item.appendChild(img);
    item.appendChild(copy);
    item.appendChild(removeBtn);
    historyList.appendChild(item);
  });
}

function addToHistory(station) {
  if (!station || !station.name) return;
  const key = `${station.name}-${station.url_resolved || ''}`;
  const exists = state.radioHistory.some(item => `${item.name}-${item.url_resolved || ''}` === key);
  if (exists) return;

  state.radioHistory.unshift(station);
  state.radioHistory = state.radioHistory.slice(0, 10);
  renderHistoryList();
}

function play(url, name, scheduledStation = null) {
  const safeUrl = actions.normalizeMediaUrl(url);
  if (!safeUrl) {
    alert('Esta radio no tiene URL disponible.');
    return;
  }

  const station = scheduledStation || state.allStations.find(item => (item.url_resolved || '').trim() === safeUrl) || {
    name,
    url_resolved: safeUrl,
    country: 'Desconocido',
    language: 'Sin idioma',
    favicon: ''
  };

  state.currentStation = station;
  addToHistory(station);
  renderSelectedStationCard();

  const player = document.getElementById('player');
  player.src = safeUrl;
  player.play().catch(error => {
    console.error('No se pudo iniciar la reproducción de la radio.', error);
    actions.showScheduleStatus('El navegador bloqueó la reproducción automática. Interactúa con Radiofy y pulsa Play.');
  });
}

export { renderSelectedStationCard, renderHistoryList, addToHistory, play };
