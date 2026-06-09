let currentEventId = null;
let allParticipants = [];

// ── Section navigation ───────────────────────────────

function showSection(name) {
  document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
  document.getElementById(`section-${name}`).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navMap = { events: 0, participants: 1, drivers: 2 };
  document.querySelectorAll('.nav-btn')[navMap[name] ?? 0]?.classList.add('active');
  if (name === 'drivers') loadDriverClockings();
}

// ── Events ───────────────────────────────────────────

async function loadEvents() {
  const res = await fetch('/api/events');
  const events = await res.json();
  const container = document.getElementById('events-list');

  if (!events.length) {
    container.innerHTML = '<p class="empty-state">No events yet. Create your first event.</p>';
    return;
  }

  container.innerHTML = events.map(e => {
    const dateStr = e.event_date
      ? new Date(e.event_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      : 'No date set';
    const pct = e.total ? Math.round((e.attended / e.total) * 100) : 0;
    return `
      <div class="event-card">
        <div class="event-card-name">${esc(e.name)}</div>
        <div class="event-card-date">${dateStr}</div>
        ${e.description ? `<div class="event-card-desc">${esc(e.description)}</div>` : ''}
        <div class="event-card-footer">
          <div class="event-card-stats">
            <strong>${e.attended ?? 0}</strong> / ${e.total ?? 0} attended
            ${e.total ? `<span>(${pct}%)</span>` : ''}
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-outline" onclick="openParticipants(${e.id}, '${esc(e.name)}')">View</button>
            <button class="btn btn-ghost" style="color:#dc2626" onclick="deleteEvent(${e.id})">✕</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function createEvent(e) {
  e.preventDefault();
  const name = document.getElementById('event-name').value.trim();
  const description = document.getElementById('event-desc').value.trim();
  const event_date = document.getElementById('event-date').value;

  const res = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, event_date })
  });

  if (res.ok) {
    closeModal('modal-event');
    document.getElementById('event-form').reset();
    toast('Event created');
    loadEvents();
  } else {
    const err = await res.json();
    alert(err.error);
  }
}

async function deleteEvent(id) {
  if (!confirm('Delete this event and all its participants?')) return;
  await fetch(`/api/events/${id}`, { method: 'DELETE' });
  toast('Event deleted');
  loadEvents();
}

// ── Participants ─────────────────────────────────────

async function openParticipants(eventId, eventName) {
  currentEventId = eventId;
  document.getElementById('participants-event-name').textContent = eventName;
  showSection('participants');
  await loadParticipants();
}

async function loadParticipants() {
  const res = await fetch(`/api/events/${currentEventId}/participants`);
  allParticipants = await res.json();
  renderParticipants(allParticipants);
  renderStats(allParticipants);
}

function renderParticipants(list) {
  const tbody = document.getElementById('participants-body');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No participants. Import a CSV to get started.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map((p, i) => {
    const attendedAt = p.attended_at
      ? new Date(p.attended_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
      : '—';
    const link = `${location.origin}/attend/${p.token}`;
    return `
      <tr>
        <td style="color:var(--muted)">${i + 1}</td>
        <td><strong>${esc(p.name)}</strong></td>
        <td style="color:var(--muted)">${esc(p.email || '—')}</td>
        <td style="color:var(--muted)">${esc(p.department || '—')}</td>
        <td>
          <span class="badge ${p.attended ? 'badge-success' : 'badge-pending'}">
            ${p.attended ? '✓ Attended' : 'Pending'}
          </span>
        </td>
        <td style="color:var(--muted)">${attendedAt}</td>
        <td>
          <button class="copy-link" onclick="copyLink('${p.token}')">Copy link</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderStats(list) {
  const total = list.length;
  const attended = list.filter(p => p.attended).length;
  const pending = total - attended;
  const pct = total ? Math.round((attended / total) * 100) : 0;

  document.getElementById('stats-row').innerHTML = `
    <div class="stat-chip"><span>Total</span><strong>${total}</strong></div>
    <div class="stat-chip success"><span>Attended</span><strong>${attended}</strong></div>
    <div class="stat-chip"><span>Pending</span><strong>${pending}</strong></div>
    <div class="stat-chip"><span>Rate</span><strong>${pct}%</strong></div>
  `;
}

function filterTable() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const filtered = allParticipants.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.email || '').toLowerCase().includes(q) ||
    (p.department || '').toLowerCase().includes(q)
  );
  renderParticipants(filtered);
}

function copyLink(token) {
  const link = `${location.origin}/attend/${token}`;
  navigator.clipboard.writeText(link).then(() => toast('Link copied!'));
}

async function clearParticipants() {
  if (!confirm('Remove all participants from this event?')) return;
  await fetch(`/api/events/${currentEventId}/participants`, { method: 'DELETE' });
  toast('Participants cleared');
  loadParticipants();
}

// ── CSV Import ───────────────────────────────────────

function openImport() {
  document.getElementById('drop-label').textContent = 'Click or drag a CSV file here';
  document.getElementById('csv-file').value = '';
  document.getElementById('import-preview').classList.add('hidden');
  document.getElementById('import-btn').disabled = true;
  openModal('modal-import');
}

function previewFile(input) {
  const file = input.files[0];
  if (!file) return;

  document.getElementById('drop-label').textContent = `Selected: ${file.name}`;
  document.getElementById('import-btn').disabled = false;

  const reader = new FileReader();
  reader.onload = (e) => {
    const lines = e.target.result.split(/\r?\n/).filter(Boolean);
    const preview = document.getElementById('import-preview');
    preview.classList.remove('hidden');
    preview.textContent = `${lines.length} row(s) detected. First row: ${lines[0]}`;
  };
  reader.readAsText(file);
}

async function importCSV() {
  const file = document.getElementById('csv-file').files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('csv', file);

  const btn = document.getElementById('import-btn');
  btn.disabled = true;
  btn.textContent = 'Importing…';

  const res = await fetch(`/api/events/${currentEventId}/import`, {
    method: 'POST',
    body: formData
  });

  btn.textContent = 'Import';

  if (res.ok) {
    const { imported } = await res.json();
    closeModal('modal-import');
    toast(`${imported} participant(s) imported`);
    loadParticipants();
  } else {
    const err = await res.json();
    alert(err.error);
    btn.disabled = false;
  }
}

// drag-and-drop on drop zone
document.addEventListener('DOMContentLoaded', () => {
  const dz = document.getElementById('drop-zone');
  if (!dz) return;
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
      const input = document.getElementById('csv-file');
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      previewFile(input);
    }
  });
});

// ── Modal helpers ────────────────────────────────────

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.add('hidden');
  }
});

// ── Toast ─────────────────────────────────────────────

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2500);
}

// ── Escape HTML ───────────────────────────────────────

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Drivers admin ────────────────────────────────────

const DRIVER_EVENT_LABELS = {
  clock_in:            'Clock In',
  clock_out:           'Clock Out',
  lodgment_departure:  'Lodgment Departure',
  lodgment_return:     'Lodgment Return',
};

const DRIVER_EVENT_COLORS = {
  clock_in:            '#16a34a',
  clock_out:           '#dc2626',
  lodgment_departure:  '#7c3aed',
  lodgment_return:     '#d97706',
};

let allDriverRows = [];

document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('driver-date-filter');
  if (!dateInput) return;
  const today = new Date();
  dateInput.value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  dateInput.addEventListener('change', loadDriverClockings);
  updateExportLink();
});

async function loadDriverClockings() {
  const date   = document.getElementById('driver-date-filter').value;
  const search = document.getElementById('driver-search').value.trim();
  const params = new URLSearchParams();
  if (date)   params.set('date',   date);
  if (search) params.set('driver', search);

  updateExportLink();

  const res  = await fetch(`/api/admin/driver-clockings?${params}`);
  allDriverRows = await res.json();
  renderDriverTable(allDriverRows);
  renderDriverStats(allDriverRows);
}

function filterDrivers() {
  const q = document.getElementById('driver-search').value.toLowerCase();
  const filtered = allDriverRows.filter(r => r.driver_name.toLowerCase().includes(q));
  renderDriverTable(filtered);
  renderDriverStats(filtered);
  loadDriverClockings();
}

function renderDriverTable(rows) {
  const tbody = document.getElementById('drivers-body');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No records found for the selected date / filter.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((r, i) => {
    const time = new Date(r.clocked_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
    const gps  = (r.latitude && r.longitude)
      ? `<a href="https://maps.google.com/?q=${r.latitude},${r.longitude}" target="_blank" style="color:var(--primary);text-decoration:none">${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)} ↗</a>`
      : '<span style="color:var(--muted)">—</span>';
    const acc  = r.accuracy ? `±${Math.round(r.accuracy)}m` : '—';
    const color = DRIVER_EVENT_COLORS[r.event_type] || '#64748b';
    const label = DRIVER_EVENT_LABELS[r.event_type] || r.event_type;
    return `<tr>
      <td style="color:var(--muted)">${i + 1}</td>
      <td><strong>${esc(r.driver_name)}</strong></td>
      <td><span style="color:${color};font-weight:600">${label}</span></td>
      <td style="color:var(--muted)">${time}</td>
      <td>${gps}</td>
      <td style="color:var(--muted)">${acc}</td>
    </tr>`;
  }).join('');
}

function renderDriverStats(rows) {
  const drivers = new Set(rows.map(r => r.driver_name)).size;
  const counts  = {};
  rows.forEach(r => { counts[r.event_type] = (counts[r.event_type] || 0) + 1; });

  document.getElementById('driver-stats-row').innerHTML = `
    <div class="stat-chip"><span>Drivers</span><strong>${drivers}</strong></div>
    <div class="stat-chip success"><span>Clock-Ins</span><strong>${counts.clock_in || 0}</strong></div>
    <div class="stat-chip"><span>Clock-Outs</span><strong>${counts.clock_out || 0}</strong></div>
    <div class="stat-chip"><span>Lodgment Events</span><strong>${(counts.lodgment_departure || 0) + (counts.lodgment_return || 0)}</strong></div>
  `;
}

function updateExportLink() {
  const date   = document.getElementById('driver-date-filter')?.value || '';
  const btn    = document.getElementById('export-drivers-btn');
  if (!btn) return;
  btn.href = `/api/admin/driver-clockings/export${date ? '?date=' + date : ''}`;
}

// ── Init ──────────────────────────────────────────────

loadEvents();
