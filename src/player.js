import { state, defaultRadioImage, truncateStationName } from './state.js';
import { actions } from './actions.js';

let nativePlaybackPlugin = null;

function isNativeApp() {
  return window.Capacitor?.isNativePlatform?.() ?? false;
}

function initializeNativePlayback() {
  if (!isNativeApp()) return;

  nativePlaybackPlugin = window.Capacitor?.Plugins?.RadioPlayback
    ?? window.Capacitor?.registerPlugin?.('RadioPlayback');
  const playerContainer = document.querySelector('.player');
  const toggleButton = document.getElementById('nativePlaybackToggle');
  if (!nativePlaybackPlugin) {
    console.error('El reproductor nativo de Radiofy no está disponible.');
    actions.showScheduleStatus('No se pudo iniciar el reproductor nativo de Radiofy.');
    return;
  }

  playerContainer.classList.add('native');
  toggleButton.hidden = false;
  toggleButton.addEventListener('click', async () => {
    try {
      if (state.isPlaying) {
        await nativePlaybackPlugin.pause();
      } else {
        await nativePlaybackPlugin.resume();
      }
    } catch (error) {
      console.error('No se pudo cambiar el estado de reproducción.', error);
      actions.showScheduleStatus('No se pudo controlar la reproducción.');
    }
  });

  nativePlaybackPlugin.addListener('playbackStateChanged', ({ isPlaying }) => {
    state.isPlaying = isPlaying;
    toggleButton.textContent = isPlaying ? 'Pausar' : 'Continuar';
    toggleButton.setAttribute('aria-label', isPlaying ? 'Pausar emisora' : 'Continuar emisora');

    if (isPlaying) {
      const rightRail = document.querySelector('.right-rail');
      rightRail.classList.add('has-played');
      rightRail.setAttribute('aria-hidden', 'false');
    }
  });

  nativePlaybackPlugin.getPlaybackState().then(({ isPlaying }) => {
    if (state.currentStation) return;
    state.isPlaying = isPlaying;
    toggleButton.textContent = isPlaying ? 'Pausar' : 'Continuar';
    toggleButton.setAttribute('aria-label', isPlaying ? 'Pausar emisora' : 'Continuar emisora');
  }).catch(error => {
    console.error('No se pudo consultar el estado de reproducción.', error);
  });

  nativePlaybackPlugin.addListener('playbackError', ({ message }) => {
    console.error('Error de reproducción nativa:', message);
    actions.showScheduleStatus(`No se pudo reproducir la emisora: ${message}`);
  });
}

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
  const fullName = state.currentStation.name || 'Radio sin nombre';
  title.textContent = truncateStationName(fullName);
  title.title = fullName;

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
    const fullName = station.name || 'Radio sin nombre';
    name.textContent = truncateStationName(fullName);
    name.title = fullName;
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

  if (isNativeApp()) {
    if (!nativePlaybackPlugin) {
      alert('El reproductor nativo de Radiofy no está disponible. Cierra y vuelve a abrir la app.');
      return;
    }

    nativePlaybackPlugin.play({
      url: safeUrl,
      title: station.name || name || 'Radio',
      country: station.country || '',
      language: station.language || ''
    }).catch(error => {
      console.error('No se pudo iniciar la reproducción en segundo plano.', error);
      actions.showScheduleStatus('No se pudo iniciar la reproducción de esta emisora.');
    });
    return;
  }

  const player = document.getElementById('player');
  player.src = safeUrl;
  player.play().catch(error => {
    console.error('No se pudo iniciar la reproducción de la radio.', error);
    actions.showScheduleStatus('El navegador bloqueó la reproducción automática. Interactúa con Radiofy y pulsa Play.');
  });
}

export { renderSelectedStationCard, renderHistoryList, addToHistory, initializeNativePlayback, play };
