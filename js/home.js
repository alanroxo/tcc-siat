// public/js/home.js
document.addEventListener('DOMContentLoaded', function () {
  // ===== Autenticação via localStorage =====
  const titleEl = document.getElementById('greetingTitle');

  function getAuth() {
    try { return JSON.parse(localStorage.getItem('siatAuth') || '{}'); }
    catch { return {}; }
  }

  const auth = getAuth();
  const isAdmin = auth?.role === 'administrador';
  const token = auth?.token || '';
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  if (!auth || !auth.role || !auth.token) {
    window.location.href = '/login';
    return;
  }

  if (isAdmin) {
    titleEl.textContent = 'Olá, Administrador!';
  } else if (auth.role === 'conselheiro') {
    titleEl.textContent = `Olá, ${auth.user || 'Conselheiro'}!`;
  } else {
    titleEl.textContent = 'Olá!';
  }

  // ===== Logout (robusto) =====
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        localStorage.removeItem('siatAuth'); // formato novo
        // legados
        localStorage.removeItem('siat_token');
        localStorage.removeItem('siat_role');
        localStorage.removeItem('siat_user');
        sessionStorage.clear();
      } catch {}
      window.location.replace('/login'); // evita voltar
    });
  }

  // ===== Subtítulo com data atual =====
  const sub = document.getElementById('subGreeting');
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });
  sub.textContent = `Hoje é ${fmt.format(new Date())}`;

  // ===== Gráfico =====
// ===== Gráfico =====
const ctx = document.getElementById('chartCanvas')?.getContext('2d');
let chartRef = null;
if (ctx) {
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // Dados representativos; se não houver cadastros, use 0
  const dadosCadastros = [12, 19, 8, 15, 22, 17, 22, 17, 0, 8, 19, 22];

  chartRef = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: meses,
      datasets: [{
        label: 'Cadastros',
        data: dadosCadastros,
        backgroundColor: 'rgba(59,130,246,.35)',
        borderColor: 'rgba(59,130,246,.9)',
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 5 }
        }
      },
      plugins: { legend: { position: 'top' } }
    }
  });
}
 

  // ===== Ajuste de altura entre cartões =====
  const chartCard  = document.querySelector('.card.chart');
  const agendaCard = document.querySelector('.card.agenda');

  function syncHeights() {
    if (!chartCard || !agendaCard) return;
    chartCard.style.height = 'auto';
    requestAnimationFrame(() => {
      const h = agendaCard.offsetHeight;
      if (h > 0) chartCard.style.height = h + 'px';
      if (chartRef) { chartRef.resize(); chartRef.update('none'); }
    });
  }

  // ===== Agenda nativa =====
  const pad2 = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const escapeHtml = (s) =>
    (s || "").replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])
    );

  const STATUS_COLORS = { pendente: "#f59e0b", andamento: "#3b82f6", resolvido: "#10b981" };

  let viewDate = new Date(); viewDate.setDate(1);
  let ocorrencias = [];
  const monthYearEl = document.getElementById("month-year");
  const calTable    = document.getElementById("calendar-table");

  // >>>>>>> Auto-fit da altura das células (5/6/7 linhas) <<<<<<<
  function autoFitCalendarHeight() {
    const cal = document.querySelector('.card.agenda .calendar');
    const table = document.getElementById('calendar-table');
    if (!cal || !table) return;

    // conta linhas do mês atual
    const rows = table.querySelectorAll('tbody tr').length || 6; // 5..7
    const headerEl = cal.querySelector('.calendar-header');
    const theadEl  = table.tHead;

    const headerH = headerEl ? headerEl.offsetHeight : 40;
    const theadH  = theadEl  ? theadEl.offsetHeight  : 32;
    const maxH = parseInt(getComputedStyle(document.documentElement)
                  .getPropertyValue('--cal-max-h')) || 560;
    const gutters = 20;

    const usable = Math.max(200, maxH - headerH - theadH - gutters);
    const cellH  = Math.max(64, Math.floor(usable / rows)); // mínimo 64px
    document.documentElement.style.setProperty('--cal-cell-h', `${cellH}px`);
  }

  // Carrega lista de ocorrências (formato flexível)
  async function loadOcorrencias() {
    try {
      const res = await fetch("/api/ocorrencias", {
        headers: { ...authHeader, Accept: "application/json" },
        cache: "no-store"
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();

      ocorrencias = (Array.isArray(data) ? data : []).map((o) => {
        const date  = o.data || o.dataEvento || o.date || o.inicio || o.start || "";
        const start = o.horaInicio || o.horarioInicio || o.startTime || o.hora || "";
        const end   = o.horaFim || o.horarioFim || o.endTime || "";
        const titulo= o.titulo || o.title || o.nome || o.nomeEvento || "Sem título";
        const descricaoBase = o.descricao || o.description || (o.extendedProps?.descricao) || "";
        const statusBase = (o.status || o.extendedProps?.status || "").toLowerCase();
        return {
          id: o.id,
          titulo,
          descricao: descricaoBase,
          status: statusBase,
          data: (date || "").slice(0, 10),
          horaInicio: (start || "").slice(0, 5),
          horaFim: (end || "").slice(0, 5),
          _raw: o
        };
      });
    } catch (e) {
      console.warn("Falha ao buscar /api/ocorrencias:", e);
      ocorrencias = [];
    }
  }

  function renderCalendar() {
    const year  = viewDate.getFullYear();
    const month = viewDate.getMonth();
    monthYearEl.textContent = viewDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    const first = new Date(year, month, 1);
    const last  = new Date(year, month + 1, 0);
    const startWeekday  = first.getDay();
    const daysInMonth   = last.getDate();
    const weeksNeeded   = Math.ceil((startWeekday + daysInMonth) / 7);

    let html = `
      <thead>
        <tr>
          <th>Dom</th><th>Seg</th><th>Ter</th><th>Qua</th><th>Qui</th><th>Sex</th><th>Sáb</th>
        </tr>
      </thead>
      <tbody>
    `;

    let day = 1;
    for (let r = 0; r < weeksNeeded; r++) {
      html += "<tr>";
      for (let c = 0; c < 7; c++) {
        if ((r === 0 && c < startWeekday) || day > daysInMonth) {
          html += "<td></td>";
        } else {
          const d = new Date(year, month, day);
          const key = ymd(d);

          const dayItems = ocorrencias
            .filter((e) => e.data === key)
            .sort((a, b) => (a.horaInicio || "").localeCompare(b.horaInicio || ""));

          const maxShow = 3;
          const chips = dayItems.slice(0, maxShow).map((ev) => {
            const hora  = (ev.horaInicio ? ev.horaInicio : "") + (ev.horaFim ? "–" + ev.horaFim : "");
            const color = STATUS_COLORS[ev.status] || "#64748b";
            return `<span class="chip" style="--chip-bg:${color}" title="${escapeHtml(ev.titulo)}">
                      ${hora ? hora + " · " : ""}${escapeHtml(ev.titulo)}
                    </span>`;
          }).join("");

          const more = Math.max(0, dayItems.length - maxShow);
          const moreChip = more ? `<span class="chip chip--more">+${more} ocorrência(s)</span>` : "";

          html += `
            <td data-date="${key}">
              <span class="date-number">${day}</span>
              <div class="events">${chips}${moreChip}</div>
            </td>
          `;
          day++;
        }
      }
      html += "</tr>";
    }
    html += "</tbody>";

    calTable.innerHTML = html;

    calTable.querySelectorAll("td[data-date]").forEach((cell) => {
      cell.addEventListener("click", () => openDayModal(cell.getAttribute("data-date")));
    });

    // encaixa a altura das células conforme nº de linhas do mês
    autoFitCalendarHeight();
    syncHeights();
  }

  function changeMonth(delta) {
    viewDate.setMonth(viewDate.getMonth() + delta);
    renderCalendar();
    autoFitCalendarHeight();
  }

  document.querySelector(".calendar-header .cal-prev")?.addEventListener("click", () => changeMonth(-1));
  document.querySelector(".calendar-header .cal-next")?.addEventListener("click", () => changeMonth(1));

  (async function initAgenda() {
    await loadOcorrencias();
    renderCalendar();
    autoFitCalendarHeight();

    setInterval(async () => {
      const before = JSON.stringify(ocorrencias);
      await loadOcorrencias();
      if (JSON.stringify(ocorrencias) !== before) {
        renderCalendar();
        autoFitCalendarHeight();
      }
    }, 5000);
  })();

  // ===== resize debounce =====
  let rAF;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(rAF);
    rAF = requestAnimationFrame(() => {
      syncHeights();
      autoFitCalendarHeight();
    });
  });

  // ===== Modal do dia =====
  window.openDayModal = function (dateStr) {
    const list = ocorrencias
      .filter((e) => e.data === dateStr)
      .sort((a, b) => (a.horaInicio || "").localeCompare(b.horaInicio || ""));

    const dayModal = document.getElementById("dayModal");
    const title    = document.getElementById("dayModalTitle");
    const ul       = document.getElementById("dayModalList");

    const d = new Date(dateStr + "T00:00:00");
    title.textContent = `Ocorrências de ${d.toLocaleDateString("pt-BR")}`;

    ul.innerHTML = list.length
      ? list.map((ev) => {
          const pill = (ev.status || "").toLowerCase();
          const desc = escapeHtml(ev.descricao || "").replace(/\n/g, "<br>");
          return `<li data-id="${ev.id ?? ''}">
            <div class="item-head">
              <strong>${escapeHtml(ev.titulo)}</strong>
              <span class="pill ${pill}">${(pill || "").toUpperCase()}</span>
            </div>
            <p class="item-desc">${desc}</p>
            <div class="item-actions">
              <button type="button" class="btn-view" data-id="${ev.id ?? ''}">Ver</button>
              ${isAdmin ? `
                <button type="button" class="btn-edit" data-id="${ev.id ?? ''}">Editar</button>
                <button type="button" class="btn-del danger" data-id="${ev.id ?? ''}">Deletar</button>
              ` : ``}
            </div>
          </li>`;
        }).join("")
      : `<li class="empty">Nenhuma ocorrência para este dia.</li>`;

    dayModal.style.display = "flex";
    dayModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  const dayModal = document.getElementById('dayModal');
  const dayModalClose = document.getElementById('dayModalClose');
  function closeDayModal(){
    dayModal.style.display = 'none';
    dayModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  dayModalClose.addEventListener('click', closeDayModal);
  dayModal.addEventListener('click', (e) => { if (e.target === dayModal) closeDayModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dayModal.getAttribute('aria-hidden') === 'false') closeDayModal(); });

  // Clique nos botões do modal do dia
  document.getElementById("dayModalList")?.addEventListener("click", async (e) => {
    const btnView = e.target.closest(".btn-view");
    const btnEdit = e.target.closest(".btn-edit");
    const btnDel  = e.target.closest(".btn-del");

    const getId = (el) => el?.getAttribute("data-id") || "";

    // VER
    if (btnView) {
      const id = getId(btnView);
      if (!id) return;
      try {
        const res = await fetch(`/api/ocorrencias/${encodeURIComponent(id)}`, {
          headers: { ...authHeader, Accept: "application/json" }, cache: "no-store"
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const det = await res.json();

        openViewModal({
          id: det.id,
          crianca_id: det.crianca_id ?? null,
          nome: det.nome || '',
          data: det.data || '',
          tipo: det.tipo || '',
          status: det.status || '',
          descricao: det.descricao || ''
        });
      } catch (err) {
        console.error('Falha ao buscar detalhes da ocorrência', err);
        alert('Não foi possível carregar os detalhes desta ocorrência.');
      }
      return;
    }

    // EDITAR
    if (btnEdit && isAdmin) {
      const id = getId(btnEdit);
      if (!id) return;

      try {
        const res = await fetch(`/api/ocorrencias/${encodeURIComponent(id)}`, {
          headers: { ...authHeader, Accept: "application/json" }, cache: "no-store"
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const det = await res.json();

        openViewModal({
          id: det.id,
          crianca_id: det.crianca_id ?? null,
          nome: det.nome || '',
          data: det.data || '',
          tipo: det.tipo || '',
          status: det.status || '',
          descricao: det.descricao || ''
        }, { editMode: true });
      } catch (err) {
        console.error('Falha ao buscar detalhes da ocorrência', err);
        alert('Não foi possível carregar os detalhes desta ocorrência.');
      }
      return;
    }

    // DELETAR
    if (btnDel && isAdmin) {
      const id = getId(btnDel);
      if (!id) return;
      if (!confirm('Confirma deletar esta ocorrência?')) return;

      try {
        const del = await fetch(`/api/ocorrencias/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { ...authHeader, Accept: 'application/json' }
        });
        if (!del.ok) throw new Error("HTTP " + del.status);

        await loadOcorrencias();
        renderCalendar();
        autoFitCalendarHeight();
        closeDayModal();
        alert('Ocorrência deletada.');
      } catch (err) {
        console.error('Falha ao deletar ocorrência', err);
        alert('Não foi possível deletar esta ocorrência.');
      }
      return;
    }
  });

  // ===== Modal de visualização/edição (admin) =====
  function openViewModal(ev, opts = {}) {
    const viewModal = document.getElementById("viewModal");
    const actions   = document.getElementById("viewActions");
    const btnEdit   = document.getElementById("btnEdit");
    const btnSave   = document.getElementById("btnSave");
    const btnCancel = document.getElementById("btnCancel");
    const btnDelete = document.getElementById("btnDelete");

    const el = {
      id:        document.getElementById("vId"),
      criancaId: document.getElementById("vCriancaId"),
      nome:      document.getElementById("vNome"),
      data:      document.getElementById("vData"),
      tipo:      document.getElementById("vTipo"),
      status:    document.getElementById("vStatus"),
      desc:      document.getElementById("vDescricao"),
    };

    let editing = !!opts.editMode;
    let current = { ...ev };

    function renderView() {
      el.id.textContent        = current.id ?? '—';
      el.criancaId.textContent = current.crianca_id ?? '—';
      el.nome.textContent      = current.nome || '—';
      el.data.textContent      = (current.data || '').slice(0,10) || '—';
      el.tipo.textContent      = current.tipo || '—';
      el.status.textContent    = current.status || '—';
      el.desc.innerHTML        = escapeHtml(current.descricao || "").replace(/\n/g, "<br>");

      if (isAdmin) {
        actions.style.display = 'flex';
        btnEdit.style.display   = editing ? 'none' : 'inline-block';
        btnSave.style.display   = editing ? 'inline-block' : 'none';
        btnCancel.style.display = editing ? 'inline-block' : 'none';
        btnDelete.style.display = editing ? 'none' : 'inline-block';
      } else {
        actions.style.display = 'none';
      }
    }

    function toEditMode() {
      editing = true;

      el.nome.innerHTML   = `<input id="inpNome" type="text" value="${escapeHtml(current.nome || '')}">`;
      el.data.innerHTML   = `<input id="inpData" type="date" value="${(current.data || '').slice(0,10)}">`;
      el.tipo.innerHTML   = `<input id="inpTipo" type="text" value="${escapeHtml(current.tipo || '')}">`;
      el.status.innerHTML = `
        <select id="inpStatus">
          <option value="pendente"${current.status==='pendente'?' selected':''}>pendente</option>
          <option value="andamento"${current.status==='andamento'?' selected':''}>andamento</option>
          <option value="resolvido"${current.status==='resolvido'?' selected':''}>resolvido</option>
        </select>`;
      el.desc.innerHTML   = `<textarea id="inpDesc" rows="6">${escapeHtml(current.descricao || '')}</textarea>`;

      actions.style.display = 'flex';
      document.getElementById('btnEdit').style.display   = 'none';
      document.getElementById('btnSave').style.display   = 'inline-block';
      document.getElementById('btnCancel').style.display = 'inline-block';
      document.getElementById('btnDelete').style.display = 'none';
    }

    function toViewMode() {
      editing = false;
      renderView();
    }

    async function doSave() {
      const nome = document.getElementById('inpNome')?.value?.trim();
      const data = document.getElementById('inpData')?.value;
      const tipo = document.getElementById('inpTipo')?.value?.trim();
      const status = document.getElementById('inpStatus')?.value?.trim();
      const descricao = document.getElementById('inpDesc')?.value?.trim();

      if (!nome || !data || !tipo || !status || !descricao) {
        alert('Preencha todos os campos.');
        return;
      }

      try {
        const body = {
          crianca_id: current.crianca_id ?? null,
          nome, data: String(data).slice(0,10), tipo, status, descricao
        };
        const resp = await fetch(`/api/ocorrencias/${encodeURIComponent(current.id)}`, {
          method: 'PUT',
          headers: { ...authHeader, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(body)
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);

        current = { ...current, ...body };

        await loadOcorrencias();
        renderCalendar();
        autoFitCalendarHeight();

        toViewMode();
        alert('Ocorrência atualizada com sucesso.');
      } catch (err) {
        console.error('Falha ao atualizar ocorrência', err);
        alert('Não foi possível salvar as alterações.');
      }
    }

    async function doDelete() {
      if (!confirm('Confirma deletar esta ocorrência?')) return;
      try {
        const resp = await fetch(`/api/ocorrencias/${encodeURIComponent(current.id)}`, {
          method: 'DELETE',
          headers: { ...authHeader, Accept: 'application/json' }
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);

        await loadOcorrencias();
        renderCalendar();
        autoFitCalendarHeight();
        closeViewModal();
        if (document.getElementById('dayModal').getAttribute('aria-hidden') === 'false') {
          closeDayModal();
        }
        alert('Ocorrência deletada.');
      } catch (err) {
        console.error('Falha ao deletar ocorrência', err);
        alert('Não foi possível deletar esta ocorrência.');
      }
    }

    btnEdit.onclick   = () => toEditMode();
    btnSave.onclick   = () => doSave();
    btnCancel.onclick = () => toViewMode();
    btnDelete.onclick = () => doDelete();

    renderView();
    if (editing) toEditMode();

    viewModal.style.display = "flex";
    viewModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  const viewModal = document.getElementById("viewModal");
  const viewModalClose = document.getElementById("viewModalClose");

  function closeViewModal() {
    viewModal.style.display = "none";
    viewModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  viewModalClose.addEventListener("click", closeViewModal);
  viewModal.addEventListener("click", (e) => { if (e.target === viewModal) closeViewModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && viewModal.getAttribute("aria-hidden") === "false") {
      closeViewModal();
    }
  });
});
