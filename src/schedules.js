import { state, SCHEDULE_STORAGE_KEY, WEEKDAY_NAMES, WEEKDAY_NAMES_CAPITALIZED, truncateStationName } from './state.js';
import { actions } from './actions.js';

function showScheduleStatus(message) {
  const status = document.getElementById('scheduleStatus');
  if (status) status.textContent = message;
}

function persistSchedules() {
  try {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(state.radioSchedules));
    return true;
  } catch (error) {
    console.error('No se pudo guardar la programación de radios.', error);
    showScheduleStatus('No se pudo guardar la programación en este navegador.');
    return false;
  }
}

function loadSchedules() {
  const storedSchedules = localStorage.getItem(SCHEDULE_STORAGE_KEY);
  if (!storedSchedules) return;

  try {
    const parsedSchedules = JSON.parse(storedSchedules);
    if (!Array.isArray(parsedSchedules)) throw new Error('El formato de programación no es válido.');
    state.radioSchedules = parsedSchedules.filter(schedule =>
      schedule &&
      typeof schedule.id === 'string' &&
      typeof schedule.time === 'string' &&
      Array.isArray(schedule.days) &&
      schedule.days.every(day => Number.isInteger(day) && day >= 0 && day <= 6) &&
      schedule.station &&
      typeof schedule.station.name === 'string' &&
      typeof schedule.station.url_resolved === 'string'
    );
  } catch (error) {
    console.error('No se pudo leer la programación guardada.', error);
    showScheduleStatus('No se pudo leer la programación guardada.');
  }
}

function setScheduleStation(station) {
  state.scheduleStation = station;
  const form = document.getElementById('scheduleForm');
  const hint = document.getElementById('scheduleEmptyFormHint');
  const selectedStation = document.getElementById('scheduleSelectedStation');
  form.hidden = !station;
  hint.hidden = Boolean(station);

  if (!station) return;

  const fullName = station.name || 'Radio sin nombre';
  selectedStation.textContent = truncateStationName(fullName);
  selectedStation.title = fullName;
  const nextHour = new Date();
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  document.getElementById('scheduleTime').value =
    `${String(nextHour.getHours()).padStart(2, '0')}:${String(nextHour.getMinutes()).padStart(2, '0')}`;
  form.querySelectorAll('input[name="days"]').forEach(day => {
    day.checked = false;
  });
  showScheduleStatus('');
}

function openScheduleDrawer(station = state.currentStation) {
  setScheduleStation(station);
  renderScheduleList();
  const drawer = document.getElementById('scheduleDrawer');
  const backdrop = document.getElementById('scheduleBackdrop');
  drawer.classList.add('open');
  backdrop.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  drawer.inert = false;
  backdrop.setAttribute('aria-hidden', 'false');
  document.getElementById('closeScheduleDrawer').focus();
}

function closeScheduleDrawer() {
  document.getElementById('scheduleDrawer').classList.remove('open');
  document.getElementById('scheduleBackdrop').classList.remove('open');
  document.getElementById('scheduleDrawer').setAttribute('aria-hidden', 'true');
  document.getElementById('scheduleDrawer').inert = true;
  document.getElementById('scheduleBackdrop').setAttribute('aria-hidden', 'true');
}

function renderScheduleList() {
  const dayPicker = document.getElementById('scheduleDayPicker');
  const container = document.getElementById('scheduleList');
  const heading = document.getElementById('scheduleAgendaHeading');
  dayPicker.innerHTML = '';
  container.innerHTML = '';

  const daysInOrder = [1, 2, 3, 4, 5, 6, 0];
  daysInOrder.forEach(day => {
    const button = document.createElement('button');
    button.className = 'schedule-day-option';
    button.type = 'button';
    button.textContent = WEEKDAY_NAMES_CAPITALIZED[day];
    button.setAttribute('aria-pressed', String(state.selectedScheduleDay === day));
    button.addEventListener('click', () => {
      state.selectedScheduleDay = day;
      renderScheduleList();
    });
    dayPicker.appendChild(button);
  });

  heading.textContent = WEEKDAY_NAMES_CAPITALIZED[state.selectedScheduleDay];
  const daySchedules = state.radioSchedules
    .filter(schedule => schedule.days.includes(state.selectedScheduleDay))
    .sort((first, second) => first.time.localeCompare(second.time));

  if (!daySchedules.length) {
    const empty = document.createElement('p');
    empty.className = 'schedule-list-empty';
    empty.textContent = `No hay radios programadas para el ${WEEKDAY_NAMES[state.selectedScheduleDay]}.`;
    container.appendChild(empty);
    return;
  }

  daySchedules.forEach(schedule => {
    const item = document.createElement('div');
    item.className = 'schedule-item';
    const time = document.createElement('span');
    time.className = 'schedule-time-label';
    time.textContent = schedule.time;
    const marker = document.createElement('span');
    marker.className = 'schedule-item-marker';
    marker.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('div');
    copy.className = 'schedule-item-copy';
    const stationName = document.createElement('strong');
    const fullName = schedule.station.name || 'Radio sin nombre';
    stationName.textContent = truncateStationName(fullName);
    stationName.title = fullName;
    const details = document.createElement('span');
    details.textContent = `Radio programada · ${schedule.days.length > 1 ? `${schedule.days.length} días` : WEEKDAY_NAMES[state.selectedScheduleDay]}`;
    const remove = document.createElement('button');
    remove.className = 'schedule-remove';
    remove.type = 'button';
    remove.textContent = 'Borrar';
    remove.setAttribute('aria-label', `Borrar programación de ${stationName.textContent}`);
    remove.addEventListener('click', () => {
      const scheduleIndex = state.radioSchedules.findIndex(item => item.id === schedule.id);
      const [removedSchedule] = state.radioSchedules.splice(scheduleIndex, 1);
      if (!persistSchedules()) {
        state.radioSchedules.splice(scheduleIndex, 0, removedSchedule);
        renderScheduleList();
        return;
      }
      renderScheduleList();
      showScheduleStatus('Programación eliminada.');
    });

    copy.appendChild(stationName);
    copy.appendChild(details);
    item.appendChild(time);
    item.appendChild(marker);
    item.appendChild(copy);
    item.appendChild(remove);
    container.appendChild(item);
  });
}

function createSchedule(event) {
  event.preventDefault();
  if (!state.scheduleStation) return;

  const time = document.getElementById('scheduleTime').value;
  const days = Array.from(document.querySelectorAll('#scheduleForm input[name="days"]:checked'))
    .map(input => Number(input.value));
  const url = actions.normalizeMediaUrl(state.scheduleStation.url_resolved);

  if (!time || !days.length || !url) {
    showScheduleStatus(!days.length
      ? 'Selecciona al menos un día de la semana.'
      : 'Esta radio no tiene una dirección de audio válida.');
    return;
  }

  const schedule = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time,
    days,
    station: {
      name: state.scheduleStation.name || 'Radio sin nombre',
      country: state.scheduleStation.country || 'Desconocido',
      language: state.scheduleStation.language || 'Sin idioma',
      url_resolved: url,
      favicon: state.scheduleStation.favicon || ''
    },
    lastTriggeredDate: ''
  };
  state.radioSchedules.push(schedule);
  if (!persistSchedules()) {
    state.radioSchedules.pop();
    return;
  }

  renderScheduleList();
  showScheduleStatus('Programación guardada.');
}

function checkRadioSchedules() {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  let triggered = false;

  state.radioSchedules.forEach(schedule => {
    if (schedule.time !== time || !schedule.days.includes(now.getDay()) || schedule.lastTriggeredDate === date) return;
    schedule.lastTriggeredDate = date;
    triggered = true;
    actions.play(schedule.station.url_resolved, schedule.station.name, schedule.station);
  });

  if (triggered) {
    persistSchedules();
    showScheduleStatus('Iniciando la radio programada. Si no comienza, revisa los permisos de reproducción del navegador.');
  }
}

export { showScheduleStatus, persistSchedules, loadSchedules, setScheduleStation, openScheduleDrawer, closeScheduleDrawer, renderScheduleList, createSchedule, checkRadioSchedules };
