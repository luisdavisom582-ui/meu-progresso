(function () {
  const dialog = document.getElementById('newAreaDialog');
  const form = document.getElementById('newAreaForm');
  const error = document.getElementById('newAreaError');
  const nameInput = document.getElementById('newAreaName');
  const goalInput = document.getElementById('newAreaGoal');
  const addButton = document.getElementById('addArea');
  const list = document.getElementById('areas');
  let editingId = null;
  let opener = addButton;

  function clearError() {
    error.textContent = '';
    nameInput.removeAttribute('aria-invalid');
    goalInput.removeAttribute('aria-invalid');
  }

  function open(area, trigger) {
    editingId = area ? String(area.id) : null;
    opener = trigger;
    form.reset();
    clearError();
    document.getElementById('newAreaTitle').textContent = area ? 'Editar área' : 'Nova área';
    document.getElementById('newAreaIntro').textContent = area
      ? 'Altere o nome ou a meta. Seus registros continuam nessa área.'
      : 'Escolha o que você quer acompanhar e defina uma meta de pontos.';
    form.querySelector('[type="submit"]').textContent = area ? 'Salvar alterações' : 'Criar área';
    if (area) {
      nameInput.value = area.name;
      goalInput.value = area.goal;
    }
    dialog.showModal();
  }

  addButton.addEventListener('click', () => open(null, addButton));
  list.addEventListener('click', event => {
    const trigger = event.target.closest('[data-edit-area]');
    if (!trigger) return;
    const area = areas.find(item => String(item.id) === trigger.dataset.editArea);
    if (area) open(area, trigger);
  });
  dialog.querySelector('.area-dialog-close').onclick = () => window.mpCloseDialog(dialog);
  dialog.querySelector('.area-dialog-cancel').onclick = () => window.mpCloseDialog(dialog);
  dialog.addEventListener('close', () => (opener?.isConnected ? opener : addButton).focus());
  form.addEventListener('input', clearError);

  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = nameInput.value.trim().replace(/\s+/g, ' ');
    const goal = Number(goalInput.value);
    const previous = areas.find(item => String(item.id) === editingId);

    function invalid(input, message) {
      error.textContent = message;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }
    if (!name || name.length > 32) return invalid(nameInput, 'Digite um nome de até 32 caracteres.');
    if (areas.some(item => item !== previous && item.name.trim().toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) {
      return invalid(nameInput, 'Você já tem uma área com esse nome.');
    }
    if (!goalInput.value.trim() || !Number.isSafeInteger(goal) || goal < 1 || goal > 100000) {
      return invalid(goalInput, 'Use um número inteiro entre 1 e 100.000 pontos.');
    }

    const palette = ['#8dbb8c', '#91b2dc', '#e6aa81', '#bd9cdb', '#df9baf', '#82bfb7'];
    const icons = ['🌱', '🎨', '🏃', '🧠', '💧', '🎯'];
    const area = previous ? { ...previous, name, goal } : {
      id: crypto.randomUUID(), name, goal,
      icon: icons[areas.length % icons.length], color: palette[areas.length % palette.length]
    };
    const updated = previous ? areas.map(item => item === previous ? area : item) : [...areas, area];

    try {
      window.mpAccountStorage.setItem('mp_areas', JSON.stringify(updated));
    } catch {
      error.textContent = 'Não foi possível salvar neste navegador. Libere espaço e tente novamente.';
      return;
    }
    areas = updated;
    render();
    opener = [...list.querySelectorAll('[data-edit-area]')].find(button => button.dataset.editArea === String(area.id));
    window.mpCloseDialog(dialog);
    if (currentUser) void persistAreaCloud(area);
    toast(previous ? 'Área atualizada.' : 'Área criada.');
  });
})();
