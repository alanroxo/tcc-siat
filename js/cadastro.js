// public/js/cadastro.js
document.addEventListener('DOMContentLoaded', () => {
  let auth = {};
  try { auth = JSON.parse(localStorage.getItem('siatAuth') || '{}'); } catch {}

  const authHeader = auth?.token ? { Authorization: `Bearer ${auth.token}` } : {};

  const params = new URLSearchParams(location.search);
  const editId = params.get('id');

  const form = document.getElementById('cadastroForm');
  const btnProximo = document.getElementById('btnProximo');
  const btnVoltar  = document.getElementById('btnVoltar');
  const btnSalvar  = document.getElementById('btnSalvar');
  const steps = document.querySelectorAll('.form-step');
  let currentStep = 0;

  function mostrarStep(n) {
    steps.forEach((s, i) => s.hidden = i !== n);
    btnVoltar.style.display = n === 0 ? 'none' : 'inline-block';
    btnProximo.hidden = n === steps.length - 1;
    btnSalvar.hidden  = n !== steps.length - 1;
  }

  btnProximo?.addEventListener('click', () => {
    if (currentStep < steps.length - 1) { currentStep++; mostrarStep(currentStep); }
  });
  btnVoltar?.addEventListener('click', () => {
    if (currentStep > 0) { currentStep--; mostrarStep(currentStep); }
  });
  mostrarStep(currentStep);

  // Máscaras
  IMask(document.getElementById('cpf'), { mask: '000.000.000-00' });
  IMask(document.getElementById('telefone_responsavel'), { mask: '(00) 00000-0000' });

  // UF e cidades
  const ufSelect = document.getElementById('uf');
  const cidadeSelect = document.getElementById('cidade');

  // Lista das UFs
  const ufs = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
  ufs.forEach(uf => {
    const opt = document.createElement('option');
    opt.value = uf;
    opt.textContent = uf;
    ufSelect.appendChild(opt);
  });

  // Função para buscar cidades do IBGE
  async function buscarCidades(ufSigla, selectedCidade = '') {
    cidadeSelect.innerHTML = '<option value="" disabled selected>Carregando cidades...</option>';
    try {
      // Pega o código da UF pelo IBGE
      const ufResp = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufSigla}`);
      const ufData = await ufResp.json();
      const ufId = ufData.id;

      // Pega municípios
      const cidadesResp = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufId}/municipios`);
      const cidades = await cidadesResp.json();

      cidadeSelect.innerHTML = '<option value="" disabled selected>Selecione a cidade</option>';
      cidades.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.nome;
        opt.textContent = c.nome;
        if (c.nome === selectedCidade) opt.selected = true;
        cidadeSelect.appendChild(opt);
      });
    } catch (err) {
      console.error(err);
      cidadeSelect.innerHTML = '<option value="" disabled>Erro ao carregar cidades</option>';
    }
  }

  ufSelect.addEventListener('change', () => buscarCidades(ufSelect.value));

  // Pré-carrega dados quando editando
  async function preloadIfEditing() {
    if (!editId) return;
    try {
      const resp = await fetch(`/api/criancas/${encodeURIComponent(editId)}`, { headers: { Accept: 'application/json' } });
      if (!resp.ok) throw new Error('Falha ao carregar dados para edição.');
      const { crianca, endereco, responsavel } = await resp.json();

      // CRIANÇA
      form.nome.value = crianca.nome || '';
      form.data_nascimento.value = (crianca.data_nascimento || '').slice(0,10);
      form.cpf.value = crianca.cpf || '';
      form.genero.value = crianca.genero || '';
      form.comorbidade.value = crianca.comorbidade || '';
      form.escolaridade.value = crianca.escolaridade || '';
      form.observacoes_crianca.value = crianca.observacoes_crianca || '';

      // ENDEREÇO
      form.uf.value = endereco?.uf || '';
      if (endereco?.uf) await buscarCidades(endereco.uf, endereco.cidade);
      form.bairro.value = endereco?.bairro || '';
      form.rua.value = endereco?.rua || '';
      form.numero.value = endereco?.numero || '';

      // RESPONSÁVEL
      form.nome_responsavel.value = responsavel?.nome_responsavel || '';
      form.data_nascimento_responsavel.value = (responsavel?.data_nascimento_responsavel || '').slice(0,10);
      form.ocupacao.value = responsavel?.ocupacao || '';
      form.estado_civil_responsavel.value = responsavel?.estado_civil_responsavel || '';
      form.genero_responsavel.value = responsavel?.genero_responsavel || '';
      form.telefone_responsavel.value = responsavel?.telefone_responsavel || '';
      form.email_responsavel.value = responsavel?.email_responsavel || '';
      form.observacao_responsavel.value = responsavel?.observacao_responsavel || '';
    } catch (e) {
      alert(e.message);
    }
  }
  preloadIfEditing();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);

    try {
      const url = editId ? `/api/criancas/${encodeURIComponent(editId)}` : '/api/criancas';
      const method = editId ? 'PUT' : 'POST';

      const resp = await fetch(url, { method, body: data, headers: { ...authHeader } });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Falha ao ${editId ? 'atualizar' : 'salvar'} cadastro`);
      }

      if (params.get('embed') === '1') {
        window.parent.postMessage({ type: editId ? 'cadastro-editado' : 'cadastro-salvo' }, '*');
      } else {
        alert(editId ? 'Cadastro atualizado!' : 'Cadastro salvo!');
        location.href = 'relatorios.html';
      }
    } catch (err) {
      alert(err.message);
    }
  });
});
