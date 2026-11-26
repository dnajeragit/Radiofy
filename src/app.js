import { state } from './state.js';
import { actions } from './actions.js';
import * as catalog from './catalog.js';
import * as player from './player.js';
import * as schedules from './schedules.js';
import * as favorites from './favorites.js';

Object.assign(actions, catalog, player, schedules, favorites);

function applyHomeCountry() {
  const queryInput = document.getElementById('query');
  const detectedCountry = actions.detectUserCountry();
  document.querySelectorAll('.nav-btn').forEach(button => button.classList.remove('active'));

  if (detectedCountry) {
    state.navigationState.continent = null;
    state.navigationState.country = detectedCountry;
    state.navigationState.region = null;
    state.activeFilter = { type: 'country', value: detectedCountry };
    queryInput.value = detectedCountry;
    document.querySelector('[data-filter-type="auto-country"]').classList.add('active');
    actions.renderCountryPanel();
    actions.buscar();
    return;
  }

  document.querySelector('[data-filter-type="auto-country"]').classList.add('active');
  document.getElementById('results').innerHTML = '<div class="empty-state">No se pudo detectar tu país desde el navegador.</div>';
}

document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(error => {
      console.error('No se pudo registrar el service worker de Radiofy.', error);
    });
  }

  const queryInput = document.getElementById('query');
  const searchBtn = document.getElementById('searchBtn');
  const rightRail = document.querySelector('.right-rail');
  document.getElementById('player').addEventListener('playing', () => {
    rightRail.classList.add('has-played');
    rightRail.setAttribute('aria-hidden', 'false');
  });
  actions.loadSchedules();
  const storedFavorites = localStorage.getItem('radiofy-favorites');
  if (storedFavorites) {
    try {
      state.favorites = JSON.parse(storedFavorites);
    } catch (error) {
      state.favorites = [];
    }
  }
  actions.renderSelectedStationCard();
  actions.renderHistoryList();
  actions.renderFavoritesList();
  actions.renderScheduleList();
  actions.loadCountries();
  actions.renderCountryPanel();
  applyHomeCountry();
  window.setInterval(actions.checkRadioSchedules, 15000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) actions.checkRadioSchedules();
  });

  document.getElementById('scheduleForm').addEventListener('submit', actions.createSchedule);
  document.getElementById('closeScheduleDrawer').addEventListener('click', actions.closeScheduleDrawer);
  document.getElementById('scheduleBackdrop').addEventListener('click', actions.closeScheduleDrawer);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') actions.closeScheduleDrawer();
  });

  searchBtn.addEventListener('click', actions.buscar);
  queryInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') actions.buscar();
  });

  document.querySelectorAll('.nav-btn').forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.action === 'open-schedules') {
        actions.openScheduleDrawer();
        return;
      }

      document.querySelectorAll('.nav-btn').forEach(navButton => navButton.classList.remove('active'));
      button.classList.add('active');

      const filterType = button.dataset.filterType;
      const filterValue = button.dataset.filterValue || '';

      if (filterType === 'auto-country') {
        const detectedCountry = actions.detectUserCountry();
        if (detectedCountry) {
          state.navigationState.continent = null;
          state.navigationState.country = detectedCountry;
          state.navigationState.region = null;
          state.activeFilter = { type: 'country', value: detectedCountry };
          queryInput.value = detectedCountry;
          actions.renderCountryPanel();
          actions.buscar();
        } else {
          document.getElementById('results').innerHTML = '<div class="empty-state">No se pudo detectar tu país desde el navegador.</div>';
        }
        return;
      }

      if (filterType === 'region') {
        state.navigationState.continent = null;
        state.navigationState.country = null;
        state.navigationState.region = null;
        state.activeFilter = { type: 'region', value: '' };
        queryInput.value = '';
        actions.renderCountryPanel();
        return;
      }

      state.activeFilter = {
        type: filterType,
        value: filterValue
      };

      state.navigationState.continent = null;
      state.navigationState.country = null;
      state.navigationState.region = null;

      if (filterType === 'search') {
        queryInput.value = '';
        actions.renderCountryPanel();
        actions.buscar();
        return;
      }

      if (filterType === 'tag') {
        queryInput.value = filterValue || 'Rock';
        actions.renderCountryPanel();
        actions.buscar();
        return;
      }

      if (filterType === 'language') {
        queryInput.value = filterValue || 'Spanish';
        actions.renderCountryPanel();
        actions.buscar();
        return;
      }

      queryInput.value = filterValue || '';
      actions.renderCountryPanel();
      actions.buscar();
    });
  });

  const resultsBox = document.getElementById('results');
  resultsBox.addEventListener('scroll', () => {
    const nearBottom = resultsBox.scrollTop + resultsBox.clientHeight >= resultsBox.scrollHeight - 200;
    if (nearBottom) actions.loadMoreStations();
  });
});
