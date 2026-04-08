const STORAGE_KEY = 'ewidencja';

const state = {
  entries: []
};

const el = (id) => document.getElementById(id);

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) state.entries = JSON.parse(data).entries;
}

function render() {
  const body = el('entriesBody');
  body.innerHTML = '';

  state.entries.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${e.day}</td><td>${e.start} - ${e.end}</td>`;
    body.appendChild(tr);
  });
}

function add() {
  state.entries.push({
    day: el('day').value,
    start: el('startTime').value,
    end: el('endTime').value
  });

  save();
  render();
}

window.onload = () => {
  load();

  el('saveBtn').onclick = add;

  for (let i = 1; i <= 31; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    el('day').appendChild(opt);
  }

  render();
};
