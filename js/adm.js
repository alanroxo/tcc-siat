(function () {
    function getAuth() {
      try { return JSON.parse(localStorage.getItem('siatAuth') || '{}'); }
      catch { return {}; }
    }
    const auth = getAuth();
    if (!auth?.token || auth?.role !== 'administrador') {
      location.href = '/login';
      return;
    }
    const authHeader = { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' };
  
    const btnLogout = document.getElementById('btnLogout');
    const btnNew = document.getElementById('btnNew');
    const modal = document.getElementById('modalConta');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCancel = document.getElementById('btnCancel');
    const btnSave = document.getElementById('btnSave');
    const modalTitle = document.getElementById('modalTitle');
  
    const fNome = document.getElementById('fNome');
    const fSenha = document.getElementById('fSenha');
    const fTipo  = document.getElementById('fTipo');
  
    let editingId = null;
  
    // ====== helper de data: "dd/mm/aaaa HH:mm" ======
    function formatDateTime(v) {
      if (!v) return '-';
      const d = new Date(v);
      if (isNaN(d)) return String(v); // se vier algo estranho, mostra como veio
      const pad = (n) => String(n).padStart(2, '0');
      const dd = pad(d.getDate());
      const mm = pad(d.getMonth() + 1);
      const yyyy = d.getFullYear();
      const HH = pad(d.getHours());
      const MM = pad(d.getMinutes());
      return `${dd}/${mm}/${yyyy} ${HH}:${MM}`;
    }
  
    function openModal(edit = false, data = null) {
      editingId = edit ? (data?.id || null) : null;
      modalTitle.textContent = edit ? `Editar Conta #${editingId}` : 'Nova Conta';
      fNome.value = data?.nome || '';
      fSenha.value = '';
      fTipo.value = (String(data?.tipo || '').toLowerCase().startsWith('adm')) ? 'adm' : 'conselheiro';
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      fNome.focus();
    }
    function closeModal() {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        localStorage.removeItem('siatAuth');
        location.replace('/login');
      });
    }
  
    async function loadList() {
      const tbody = document.getElementById('tbodyContas');
      tbody.innerHTML = `<tr><td colspan="6" style="padding:10px;">Carregando...</td></tr>`;
      try {
        const res = await fetch('/api/contas?tipo=conselheiro', { headers: { Authorization: `Bearer ${auth.token}` } });
        if (!res.ok) throw new Error('Falha ao carregar');
        const data = await res.json();
        const items = data.items || [];
        if (!items.length) {
          tbody.innerHTML = `<tr><td colspan="6" style="padding:10px;">Nenhum conselheiro encontrado.</td></tr>`;
          return;
        }
        tbody.innerHTML = '';
        items.forEach(it => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="padding:10px; border-bottom:1px solid #eee;">${it.id}</td>
            <td style="padding:10px; border-bottom:1px solid #eee;">${it.nome}</td>
            <td style="padding:10px; border-bottom:1px solid #eee;">${it.tipo}</td>
            <td style="padding:10px; border-bottom:1px solid #eee;">${formatDateTime(it.created_at)}</td>
            <td style="padding:10px; border-bottom:1px solid #eee;">${formatDateTime(it.updated_at)}</td>
            <td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">
              <button class="btn" data-edit="${it.id}">Editar</button>
              <button class="btn danger" data-del="${it.id}">Excluir</button>
            </td>`;
          tr.dataset.row = JSON.stringify(it);
          tbody.appendChild(tr);
        });
      } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding:10px; color:crimson;">Erro: ${e.message}</td></tr>`;
      }
    }
  
    async function saveConta() {
      const nome = fNome.value.trim();
      const senha = fSenha.value.trim();
      const tipo  = fTipo.value;
      if (!nome) return alert('Informe o nome.');
      if (!editingId && !senha) return alert('Informe a senha para nova conta.');
      try {
        if (editingId) {
          const payload = { nome, tipo };
          if (senha) payload.senha = senha;
          const res = await fetch(`/api/contas/${editingId}`, { method:'PUT', headers: authHeader, body: JSON.stringify(payload) });
          if (!res.ok) { const j = await res.json().catch(()=>({})); throw new Error(j?.error || 'Falha ao atualizar'); }
        } else {
          const res = await fetch('/api/contas', { method:'POST', headers: authHeader, body: JSON.stringify({ nome, senha, tipo }) });
          if (!res.ok) { const j = await res.json().catch(()=>({})); throw new Error(j?.error || 'Falha ao criar'); }
        }
        closeModal();
        loadList();
      } catch (e) { alert(e.message); }
    }
  
    async function deleteConta(id) {
      if (!confirm(`Excluir conta #${id}?`)) return;
      try {
        const res = await fetch(`/api/contas/${id}`, { method:'DELETE', headers: { Authorization: `Bearer ${auth.token}` } });
        if (!res.ok) { const j = await res.json().catch(()=>({})); throw new Error(j?.error || 'Falha ao excluir'); }
        loadList();
      } catch (e) { alert(e.message); }
    }
  
    btnNew.addEventListener('click', () => openModal(false, null));
    btnCloseModal.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);
    btnSave.addEventListener('click', saveConta);
  
    document.addEventListener('click', (e) => {
      const btnE = e.target.closest('[data-edit]');
      const btnD = e.target.closest('[data-del]');
      if (btnE) {
        const tr = btnE.closest('tr');
        openModal(true, JSON.parse(tr.dataset.row || '{}'));
      }
      if (btnD) deleteConta(Number(btnD.getAttribute('data-del')));
    });
  
    loadList();
  })();