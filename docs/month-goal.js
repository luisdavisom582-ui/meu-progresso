(function () {
  const key = 'mp_month_goals';
  const byId = id => document.getElementById(id);
  const dialog = byId('monthGoalDialog');
  const dayList = byId('monthDays');
  const dayActions = byId('monthDayActions');
  const distribution = byId('monthDistribution');
  const areaInputs = byId('monthAreaInputs');
  const status = byId('monthStatus');
  const emptyGoal = { name: '', days: {}, result: '', allocations: {} };
  const currentDate = () => iso(new Date());
  const currentMonth = () => currentDate().slice(0, 7);
  const goals = () => readStore(key, {});
  const formatPoints = value => value + (value === 1 ? ' ponto' : ' pontos');
  const total = allocations => Object.values(allocations).reduce((sum, value) => sum + value, 0);
  const earned = goal => Object.values(goal.days).filter(state => state === 'done').length + (goal.result === 'complete' ? 10 : 0);
  const monthStart = month => new Date(month + '-01T12:00:00');
  const monthFormat = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
  const dayFormat = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' });
  let month;
  let selected;

  function lastDay() {
    const start = monthStart(month);
    return new Date(start.getFullYear(), start.getMonth() + 1, 0, 12).getDate();
  }
  function dateKey(day) {
    return month + '-' + String(day).padStart(2, '0');
  }
  function monthEnded() {
    return currentDate() >= dateKey(lastDay());
  }
  function updateSummary() {
    const goal = goals()[currentMonth()];
    byId('monthGoalSummary').textContent = goal?.name
      ? goal.name + ' · ' + formatPoints(earned(goal))
      : 'Acompanhe sua meta dia a dia.';
  }

  function save(change, message, redraw = true) {
    const all = goals();
    const goal = change(all[month] || emptyGoal);
    if (total(goal.allocations) > earned(goal)) {
      status.textContent = 'O total distribuído não pode passar dos pontos ganhos. Ajuste a distribuição primeiro.';
      return false;
    }
    try {
      window.mpAccountStorage.setItem(key, JSON.stringify({ ...all, [month]: goal }));
    } catch {
      status.textContent = 'Não consegui salvar a meta neste navegador. Tente novamente.';
      return false;
    }
    if (redraw) render();
    updateSummary();
    status.textContent = message;
    return true;
  }

  function renderCalendar(goal) {
    const offset = (monthStart(month).getDay() + 6) % 7;
    const cells = Array.from({ length: offset }, () => document.createElement('span'));
    const dayStates = { done: 'feito', missed: 'não feito' };
    for (let day = 1; day <= lastDay(); day++) {
      const date = dateKey(day);
      const state = goal.days[date];
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.date = date;
      if (state) button.dataset.state = state;
      button.disabled = date > currentDate();
      button.textContent = day + (state === 'done' ? ' ✓' : state === 'missed' ? ' ×' : '');
      button.setAttribute('aria-label', dayFormat.format(new Date(date + 'T12:00:00')) + ', ' + (dayStates[state] || 'sem marcação'));
      button.setAttribute('aria-pressed', String(date === selected));
      cells.push(button);
    }
    dayList.replaceChildren(...cells);
  }

  function renderDistribution(goal, points) {
    distribution.hidden = !monthEnded() || !areas.length || points === 0;
    areaInputs.replaceChildren(...areas.map(area => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = String(points);
      input.step = '1';
      input.inputMode = 'numeric';
      input.dataset.area = String(area.id);
      input.value = goal.allocations[area.id] ?? 0;
      label.append(document.createTextNode(area.name), input);
      return label;
    }));
  }

  function render() {
    const goal = goals()[month] || emptyGoal;
    byId('monthName').value = goal.name;
    byId('monthLabel').textContent = monthFormat.format(monthStart(month));
    byId('monthNext').disabled = month === currentMonth();
    byId('monthPrevious').disabled = month === '1900-01';
    byId('monthDetails').hidden = !goal.name;
    const end = monthEnded();
    const result = byId('monthResult');
    result.value = goal.result;
    result.disabled = !end;
    byId('monthResultHint').textContent = end
      ? 'A conclusão da meta dá 10 pontos extras.'
      : 'O resultado e a distribuição abrem no último dia do mês.';
    const points = earned(goal);
    byId('monthPoints').textContent = formatPoints(points) + ' no total · Saldo para distribuir: ' + formatPoints(points - total(goal.allocations));
    renderCalendar(goal);
    byId('monthDayOptions').hidden = !selected;
    if (selected) byId('monthDayLabel').textContent = dayFormat.format(new Date(selected + 'T12:00:00'));
    renderDistribution(goal, points);
  }

  function moveMonth(change) {
    const date = monthStart(month);
    date.setMonth(date.getMonth() + change);
    const next = iso(date).slice(0, 7);
    if (next < '1900-01' || next > currentMonth()) return;
    month = next;
    selected = null;
    status.textContent = '';
    render();
  }

  window.monthGoalPointsForArea = id => Object.values(goals()).reduce((sum, goal) => sum + (goal.allocations?.[id] || 0), 0);
  byId('openMonthGoal').addEventListener('click', () => {
    month = currentMonth();
    selected = null;
    status.textContent = '';
    render();
    dialog.showModal();
    byId('monthGoalTitle').focus({ preventScroll: true });
  });
  byId('monthPrevious').addEventListener('click', () => moveMonth(-1));
  byId('monthNext').addEventListener('click', () => moveMonth(1));
  byId('monthNameForm').addEventListener('submit', event => {
    event.preventDefault();
    const name = byId('monthName').value.trim();
    if (!name) { status.textContent = 'Digite o nome da sua meta.'; return; }
    save(goal => ({ ...goal, name }), 'Meta salva.');
  });
  dayList.addEventListener('click', event => {
    const button = event.target.closest('button[data-date]');
    if (!button || button.disabled) return;
    dayList.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-pressed', 'true');
    selected = button.dataset.date;
    byId('monthDayLabel').textContent = dayFormat.format(new Date(selected + 'T12:00:00'));
    byId('monthDayOptions').hidden = false;
  });
  dayActions.addEventListener('click', event => {
    const button = event.target.closest('[data-mark]');
    if (!button || !selected || selected > currentDate()) return;
    save(goal => {
      const days = { ...goal.days };
      if (button.dataset.mark) days[selected] = button.dataset.mark;
      else delete days[selected];
      return { ...goal, days };
    }, 'Dia atualizado.');
  });
  byId('monthResult').addEventListener('change', event => {
    if (!monthEnded()) return;
    if (!save(goal => ({ ...goal, result: event.target.value }), 'Resultado atualizado.')) {
      event.target.value = goals()[month]?.result || '';
    }
  });
  distribution.addEventListener('submit', event => {
    event.preventDefault();
    if (!monthEnded()) return;
    const allocations = Object.fromEntries([...areaInputs.querySelectorAll('input')]
      .map(input => [input.dataset.area, Number(input.value)]).filter(([, points]) => points > 0));
    if (save(goal => ({ ...goal, allocations }), 'Distribuição salva.', false)) {
      render();
      renderAreas();
      distribution.querySelector('button[type="submit"]').focus();
    }
  });

  updateSummary();
  renderAreas();
})();
