
  <script>
    const STORAGE_KEY = 'ewidencja-czasu-pracy-v1';
    const now = new Date();
    const state = loadState() || {
      month: now.getMonth(),
      year: now.getFullYear(),
      fullName: '',
      crps: [],
      entries: [],
      activeTimer: null,
      editingId: null
    };

    if (state.month !== now.getMonth() || state.year !== now.getFullYear()) {
      state.month = now.getMonth();
      state.year = now.getFullYear();
      state.entries = [];
      state.activeTimer = null;
      state.editingId = null;
    }

    const el = (id) => document.getElementById(id);
    const monthLabel = el('monthLabel');
    const daySelect = el('day');
    const crpSelect = el('crpSelect');
    const entriesBody = el('entriesBody');
    const crpSummaryBody = el('crpSummaryBody');
    const fullNameInput = el('fullName');
    const printSheet = el('printSheet');

    function loadState() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
    }
    function saveState() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    function polishMonthYear(d) {
      return d.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
    }
    function daysInMonth(year, month) {
      return new Date(year, month + 1, 0).getDate();
    }
    function isWeekend(day) {
      const d = new Date(state.year, state.month, day);
      const w = d.getDay();
      return w === 0 || w === 6;
    }
    function decimalHours(start, end) {
      if (!start || !end) return 0;
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      let minutes = (eh * 60 + em) - (sh * 60 + sm);
      if (minutes < 0) minutes += 24 * 60;
      return Math.round((minutes / 60) * 100) / 100;
    }
    function fmtHours(num) {
      return (Math.round(num * 100) / 100).toFixed(2).replace('.', ',');
    }
    function renderDays() {
      const total = daysInMonth(state.year, state.month);
      daySelect.innerHTML = '';
      for (let i = 1; i <= total; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        daySelect.appendChild(opt);
      }
      daySelect.value = now.getDate() <= total ? now.getDate() : 1;
    }
    function crpDisplayName(crp) {
      return crp.label ? `${crp.code}_${crp.label}` : crp.code;
    }
    function renderCrps() {
      crpSelect.innerHTML = '';
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = 'Wybierz CRP';
      crpSelect.appendChild(blank);
      state.crps.forEach((crp) => {
        const opt = document.createElement('option');
        opt.value = crp.id;
        opt.textContent = crpDisplayName(crp);
        crpSelect.appendChild(opt);
      });
      el('crpChips').innerHTML = '';
      state.crps.forEach((crp) => {
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.textContent = crpDisplayName(crp);
        chip.title = 'Kliknij, aby wczytać do edycji';
        chip.style.cursor = 'pointer';
        chip.onclick = () => {
          el('crpCode').value = crp.code;
          el('crpLabel').value = crp.label || '';
        };
        el('crpChips').appendChild(chip);
      });
    }
    function renderEntries() {
      const sorted = [...state.entries].sort((a,b) => a.day - b.day || (a.start || '').localeCompare(b.start || ''));
      entriesBody.innerHTML = '';
      sorted.forEach((entry) => {
        const tr = document.createElement('tr');
        if (isWeekend(entry.day)) tr.classList.add('weekend');
        const crp = state.crps.find(c => c.id === entry.crpId);
        tr.innerHTML = `
          <td>${entry.day}</td>
          <td>${crp ? crpDisplayName(crp) : ''}</td>
          <td>${entry.start || ''}</td>
          <td>${entry.end || ''}</td>
          <td>${fmtHours(entry.hours || 0)}</td>
          <td>${escapeHtml(entry.description || '')}</td>
          <td>
            <div class="actions">
              <button class="mini secondary" data-edit="${entry.id}">Edytuj</button>
              <button class="mini ghost" data-duplicate="${entry.id}">Duplikuj</button>
              <button class="mini danger" data-delete="${entry.id}">Usuń</button>
            </div>
          </td>`;
        entriesBody.appendChild(tr);
      });
      entriesBody.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => editEntry(btn.dataset.edit));
      entriesBody.querySelectorAll('[data-delete]').forEach(btn => btn.onclick = () => deleteEntry(btn.dataset.delete));
      entriesBody.querySelectorAll('[data-duplicate]').forEach(btn => btn.onclick = () => duplicateEntry(btn.dataset.duplicate));
      updateSummary();
    }
    function updateSummary() {
      const total = state.entries.reduce((a,e) => a + (e.hours || 0), 0);
      el('sumHours').textContent = fmtHours(total);
      el('rowCount').textContent = String(state.entries.length);
      el('timerState').textContent = state.activeTimer ? `dzień ${state.activeTimer.day}, od ${state.activeTimer.start}` : 'brak';

      const map = new Map();
      state.entries.forEach((e) => {
        const crp = state.crps.find(c => c.id === e.crpId);
        const code = crp ? crp.code : '';
        if (!code) return;
        map.set(code, (map.get(code) || 0) + (e.hours || 0));
      });
      crpSummaryBody.innerHTML = '';
      [...map.entries()].sort((a,b) => a[0].localeCompare(b[0])).forEach(([code, hours]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${code}</td><td>${fmtHours(hours)}</td>`;
        crpSummaryBody.appendChild(tr);
      });
      fullNameInput.value = state.fullName || '';
      buildPrintPreview(false);
      saveState();
    }
    function escapeHtml(str) {
      return str.replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    }
    function resetForm() {
      state.editingId = null;
      el('startTime').value = '';
      el('endTime').value = '';
      el('description').value = '';
      crpSelect.value = '';
    }
    function saveEntry() {
      const day = Number(daySelect.value);
      const crpId = crpSelect.value;
      const start = el('startTime').value;
      const end = el('endTime').value;
      const description = el('description').value.trim();
      if (!day || !crpId || !start || !end) {
        alert('Uzupełnij dzień, CRP, start i koniec.');
        return;
      }
      const hours = decimalHours(start, end);
      const payload = { day, crpId, start, end, hours, description };
      if (state.editingId) {
        const idx = state.entries.findIndex(e => e.id === state.editingId);
        if (idx >= 0) state.entries[idx] = { ...state.entries[idx], ...payload };
      } else {
        state.entries.push({ id: crypto.randomUUID(), ...payload });
      }
      resetForm();
      renderEntries();
    }
    function editEntry(id) {
      const e = state.entries.find(x => x.id === id);
      if (!e) return;
      state.editingId = id;
      daySelect.value = e.day;
      crpSelect.value = e.crpId;
      el('startTime').value = e.start || '';
      el('endTime').value = e.end || '';
      el('description').value = e.description || '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function deleteEntry(id) {
      if (!confirm('Usunąć wpis?')) return;
      state.entries = state.entries.filter(e => e.id !== id);
      if (state.editingId === id) resetForm();
      renderEntries();
    }
    function duplicateEntry(id) {
      const e = state.entries.find(x => x.id === id);
      if (!e) return;
      state.entries.push({ ...e, id: crypto.randomUUID() });
      renderEntries();
    }
    function copyPreviousDay() {
      const day = Number(daySelect.value);
      if (day <= 1) return alert('Brak poprzedniego dnia do skopiowania.');
      const prev = state.entries.filter(e => e.day === day - 1);
      if (!prev.length) return alert('Poprzedni dzień nie ma wpisów.');
      prev.forEach(e => state.entries.push({ ...e, id: crypto.randomUUID(), day }));
      renderEntries();
    }
    function addOrUpdateCrp() {
      const code = el('crpCode').value.trim();
      const label = el('crpLabel').value.trim();
      if (!code) return alert('Wpisz kod CRP.');
      const existing = state.crps.find(c => c.code === code);
      if (existing) existing.label = label;
      else state.crps.push({ id: crypto.randomUUID(), code, label });
      el('crpCode').value = '';
      el('crpLabel').value = '';
      renderCrps();
      saveState();
    }
    function startTimer() {
      const day = Number(daySelect.value);
      const crpId = crpSelect.value;
      if (!crpId) return alert('Najpierw wybierz CRP.');
      const d = new Date();
      state.activeTimer = {
        day,
        crpId,
        start: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
        description: el('description').value.trim()
      };
      el('startTime').value = state.activeTimer.start;
      updateSummary();
    }
    function stopTimer() {
      if (!state.activeTimer) return alert('Brak aktywnego timera.');
      const d = new Date();
      const end = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      const payload = {
        id: crypto.randomUUID(),
        day: state.activeTimer.day,
        crpId: state.activeTimer.crpId,
        start: state.activeTimer.start,
        end,
        hours: decimalHours(state.activeTimer.start, end),
        description: el('description').value.trim() || state.activeTimer.description || ''
      };
      state.entries.push(payload);
      state.activeTimer = null;
      el('endTime').value = end;
      renderEntries();
    }
    function buildPrintPreview(showAlert = false) {
      const totalDays = daysInMonth(state.year, state.month);
      const byDay = new Map();
      state.entries.forEach(e => {
        if (!byDay.has(e.day)) byDay.set(e.day, []);
        byDay.get(e.day).push(e);
      });
      let rows = '';
      for (let day = 1; day <= totalDays; day++) {
        const entries = (byDay.get(day) || []).sort((a,b) => (a.start || '').localeCompare(b.start || ''));
        if (!entries.length) {
          rows += `<tr class="${isWeekend(day) ? 'weekend' : ''}">
            <td style="text-align:center;">${day}</td>
            <td></td><td></td><td></td><td style="text-align:right;"></td><td></td><td></td><td></td>
          </tr>`;
        } else {
          entries.forEach((entry, idx) => {
            const crp = state.crps.find(c => c.id === entry.crpId);
            rows += `<tr class="${isWeekend(day) ? 'weekend' : ''}">
              <td style="text-align:center;">${idx === 0 ? day : ''}</td>
              <td>${crp ? escapeHtml(crp.code) : ''}</td>
              <td style="text-align:center;">${entry.start || ''}</td>
              <td style="text-align:center;">${entry.end || ''}</td>
              <td style="text-align:right;">${fmtHours(entry.hours || 0)}</td>
              <td>${escapeHtml(entry.description || '')}</td>
              <td></td>
              <td></td>
            </tr>`;
          });
        }
      }
      const totalHours = state.entries.reduce((a,e) => a + (e.hours || 0), 0);
      const map = new Map();
      state.entries.forEach((e) => {
        const crp = state.crps.find(c => c.id === e.crpId);
        if (!crp) return;
        map.set(crp.code, (map.get(crp.code) || 0) + (e.hours || 0));
      });
      const crpRows = [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]))
        .map(([code,h]) => `<tr><td>${escapeHtml(code)}</td><td style="text-align:right;">${fmtHours(h)}</td></tr>`).join('');

      printSheet.innerHTML = `
        <div class="doc-title">Ewidencja czasu pracy</div>
        <div class="doc-meta">
          <div>Imię i Nazwisko: ${escapeHtml(state.fullName || '')}</div>
          <div>Miesiąc: ${escapeHtml(polishMonthYear(new Date(state.year, state.month, 1)))}</div>
        </div>
        <table class="doc-table" style="width:100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="width:6%;">Dzień</th>
              <th style="width:14%;">Numer CRP</th>
              <th style="width:12%;">Godzina rozpoczęcia pracy</th>
              <th style="width:12%;">Godzina zakończenia pracy</th>
              <th style="width:10%;">Suma godzin</th>
              <th style="width:26%;">Opis prac</th>
              <th style="width:10%;">Podpis Kierownika</th>
              <th style="width:10%;">Podpis Lidera</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="doc-bottom">
          <div>
            <div style="margin-top:6px; font-size:10px; font-weight:700;">SUMA: ${fmtHours(totalHours)}</div>
          </div>
          <div>
            <table class="doc-table" style="width:100%; border-collapse: collapse;">
              <thead><tr><th>Numer CRP</th><th>Suma godzin</th></tr></thead>
              <tbody>${crpRows}</tbody>
            </table>
          </div>
        </div>
        <div class="doc-sign">
          <div>
            <div class="sign-line">Podpis osoby zatwierdzającej</div>
          </div>
          <div></div>
        </div>`;
      if (showAlert) alert('Podgląd A4 został odświeżony. Użyj Drukuj / Zapisz PDF.');
    }

    // events
    el('saveBtn').onclick = saveEntry;
    el('resetBtn').onclick = resetForm;
    el('addCrpBtn').onclick = addOrUpdateCrp;
    el('seedCrpBtn').onclick = () => { el('crpCode').value = '17052-00'; el('crpLabel').value = 'E75'; };
    el('startBtn').onclick = startTimer;
    el('stopBtn').onclick = stopTimer;
    el('copyPrevBtn').onclick = copyPreviousDay;
    el('previewBtn').onclick = () => buildPrintPreview(true);
    el('printBtn').onclick = () => { buildPrintPreview(false); window.print(); };
    fullNameInput.oninput = () => { state.fullName = fullNameInput.value; updateSummary(); };

    monthLabel.textContent = `Bieżący miesiąc: ${polishMonthYear(new Date(state.year, state.month, 1))}`;
    renderDays();
    renderCrps();
    renderEntries();
  </script>
