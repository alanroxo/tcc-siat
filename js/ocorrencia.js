document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formOcorrencia');
  const mensagem = document.getElementById('mensagem');
  const selCrianca = document.getElementById('criancaId');

  // Carrega lista de crianças para o <select>
  async function carregarCriancas() {
    try {
      selCrianca.innerHTML = '<option value="">Carregando...</option>';

      const resp = await fetch('/api/criancas/list', {
        headers: { Accept: 'application/json' }
      });
      if (!resp.ok) throw new Error('Falha ao carregar crianças');
      const data = await resp.json();

      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) {
        selCrianca.innerHTML = '<option value="">Nenhuma criança cadastrada</option>';
        return;
      }

      selCrianca.innerHTML = '<option value="">Selecione</option>';
      // value = id; texto = nome (pode mostrar status junto se quiser)
      for (const c of items) {
        const opt = document.createElement('option');
        opt.value = c.id;                       // será usado como crianca_id
        opt.textContent = c.nome || `ID ${c.id}`;
        // guarda o nome em data-* para usar no submit (compatibilidade)
        opt.dataset.nome = c.nome || '';
        selCrianca.appendChild(opt);
      }
    } catch (err) {
      selCrianca.innerHTML = '<option value="">Erro ao carregar</option>';
      console.error(err);
    }
  }

  carregarCriancas();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const crianca_id = Number(selCrianca.value || 0);
    const criancaNome = selCrianca.selectedOptions[0]?.dataset?.nome || selCrianca.selectedOptions[0]?.textContent || '';

    if (!crianca_id) {
      mensagem.textContent = 'Selecione a criança.';
      mensagem.className = 'help error';
      selCrianca.focus();
      return;
    }

    const payload = {
      // Envie o ID (principal). Mantenho o nome por compatibilidade com o backend atual.
      crianca_id,
      nome: criancaNome,
      data: document.getElementById('data').value,
      tipo: document.getElementById('tipo').value,
      status: document.getElementById('status').value,
      descricao: document.getElementById('descricao').value.trim()
    };

    try {
      const resp = await fetch('/api/ocorrencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao salvar ocorrência');
      }

      mensagem.textContent = 'Ocorrência registrada com sucesso!';
      mensagem.className = 'help ok';
      form.reset();
      // mantém a seleção vazia
      selCrianca.value = '';

      setTimeout(() => { window.location.href = 'home.html'; }, 800);
    } catch (err) {
      mensagem.textContent = err.message;
      mensagem.className = 'help error';
    }
  });
});
