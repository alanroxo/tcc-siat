document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('cadastroForm');
    const btnProximo = document.getElementById('btnProximo');
    const btnVoltar = document.getElementById('btnVoltar');
    const btnSalvar = document.getElementById('btnSalvar');
    const steps = document.querySelectorAll('.form-step');
    let currentStep = 0;
  
    function mostrarStep(n) {
      steps.forEach((s, i) => s.hidden = i !== n);
      btnVoltar.style.display = n === 0 ? 'none' : 'inline-block';
      btnProximo.hidden = n === steps.length - 1;
      btnSalvar.hidden = n !== steps.length - 1;
    }
  
    btnProximo.addEventListener('click', () => {
      if (currentStep < steps.length - 1) {
        currentStep++;
        mostrarStep(currentStep);
      }
    });
  
    btnVoltar.addEventListener('click', () => {
      if (currentStep > 0) {
        currentStep--;
        mostrarStep(currentStep);
      }
    });
  
    mostrarStep(currentStep);
  
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(form);
  
      try {
        const resp = await fetch('/api/criancas', { method: 'POST', body: data });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || 'Falha ao salvar cadastro');
        }
        alert('Cadastro salvo com sucesso!');
        form.reset();
        window.location.href = 'relatorios.html';
      } catch (err) {
        alert(err.message);
      }
    });
  });
  