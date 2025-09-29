(function () {
  function getAuth() {
    try { return JSON.parse(localStorage.getItem('siatAuth') || '{}'); }
    catch { return {}; }
  }
  const auth = getAuth();
  if (!auth?.token || !auth?.role) {
    location.href = '/login';
    return;
  }

  // Logout
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('siatAuth');
      localStorage.removeItem('siat_token');
      localStorage.removeItem('siat_role');
      localStorage.removeItem('siat_user');
      sessionStorage.clear();
      location.replace('/login');
    });
  }

  // Formata data para dd/mm/aaaa
  function formatarData(dataStr) {
    if (!dataStr) return '-';
    const d = new Date(dataStr);
    if (isNaN(d)) return dataStr;
    return d.toLocaleDateString('pt-BR');
  }

  // Carrega lista
  async function carregarRelatorios() {
    const tbody = document.getElementById('tabela-relatorios');
    tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';

    try {
      const resp = await fetch('/api/criancas/list', { headers: { Accept: 'application/json' } });
      if (!resp.ok) throw new Error('Falha ao carregar lista');
      const data = await resp.json();

      tbody.innerHTML = '';
      (data.items || []).forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${c.nome}</td>
          <td>${formatarData(c.data_cadastro)}</td>
          <td>${c.status}</td>
          <td>${c.id}</td>
          <td class="actions">
            <button class="action is-view" data-view="${c.id}" title="Ver">👁 Ver</button>
            <button class="action is-edit" data-edit="${c.id}" title="Editar">✏️ Editar</button>
            <button class="action is-del" data-del="${c.id}" title="Excluir">🗑 Excluir</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
      if ((data.items || []).length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">Nenhum registro encontrado</td></tr>';
      }
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5">Erro: ${err.message}</td></tr>`;
    }
  }

  // Ver detalhes
  async function verDetalhes(id) {
    try {
      const resp = await fetch(`/api/criancas/${id}`, { headers: { Accept: 'application/json' } });
      if (!resp.ok) throw new Error('Erro ao buscar detalhes');
      const data = await resp.json();
      const el = document.getElementById('modal-detalhes');
      el.innerHTML = `
        <h2>${data.crianca.nome} (ID ${data.crianca.id})</h2>
        <p><b>Status:</b> ${data.crianca.status}</p>
        <p><b>Data de Nascimento:</b> ${formatarData(data.crianca.data_nascimento)}</p>
        <hr/>
        <p><b>Endereço:</b> ${data.endereco?.rua || '-'}, ${data.endereco?.numero || '-'} - ${data.endereco?.bairro || '-'} - ${data.endereco?.cidade || '-'} / ${data.endereco?.uf || '-'}</p>
        <hr/>
        <p><b>Responsável:</b> ${data.responsavel?.nome_responsavel || '-'}</p>
        <p><b>Contato:</b> ${data.responsavel?.telefone_responsavel || '-'} | ${data.responsavel?.email_responsavel || '-'}</p>
        <p><b>Observações:</b> ${data.crianca.observacoes_crianca || '-'}</p>
      `;
      const modal = document.getElementById('modal');
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    } catch (e) {
      alert(e.message);
    }
  }

  // Excluir
  async function excluirCrianca(id) {
    if (!confirm('Excluir cadastro?')) return;
    const resp = await fetch(`/api/criancas/${id}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
    if (resp.ok) carregarRelatorios();
    else {
      const j = await resp.json().catch(() => ({}));
      alert(j?.error || 'Erro ao excluir');
    }
  }

  // Editar
  function editarCrianca(id) {
    if (typeof window.openCadastroModal === 'function') window.openCadastroModal(id);
    else location.href = `cadastro.html?id=${encodeURIComponent(id)}`;
  }

  // Eventos tabela
  document.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('[data-view]');
    const delBtn  = e.target.closest('[data-del]');
    const editBtn = e.target.closest('[data-edit]');
    if (viewBtn) verDetalhes(viewBtn.dataset.view);
    if (editBtn) editarCrianca(editBtn.dataset.edit);
    if (delBtn)  excluirCrianca(delBtn.dataset.del);
  });

  // Pesquisa
  window.pesquisarCadastro = () => {
    const q = (document.getElementById('pesquisa').value || '').toLowerCase();
    document.querySelectorAll('#tabela-relatorios tr').forEach(tr => {
      const nome = (tr.children[0]?.textContent || '').toLowerCase();
      tr.style.display = nome.includes(q) ? '' : 'none';
    });
  };

  // Fechar modal
  window.fecharModal = () => {
    const modal = document.getElementById('modal');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.getElementById('modal-detalhes').innerHTML = '';
    document.body.style.overflow = '';
  };

  document.addEventListener('DOMContentLoaded', carregarRelatorios);
})();
