document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const roleSelect = document.getElementById('roleSelect');
  const usernameField = document.getElementById('usernameField');
  const passwordField = document.getElementById('passwordField');
  const msg = document.getElementById('loginMsg');
  const btn = document.getElementById('btnLogin');
  const togglePassword = document.getElementById('togglePassword');

  // Se já tem sessão, pula direto para a página correta
  try {
    const saved = JSON.parse(localStorage.getItem('siatAuth') || 'null');
    if (saved && saved.token) {
      window.location.href = saved.role === 'administrador' ? '/adm' : '/home';
      return;
    }
  } catch {}

  // Alterna visibilidade da senha
  togglePassword.addEventListener('click', () => {
    const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordField.setAttribute('type', type);
    togglePassword.textContent = type === 'password' ? '👁️' : '🙈';
  });

  function showMsg(text, isError = false) {
    msg.textContent = text || '';
    msg.style.color = isError ? 'crimson' : '#0a7';
  }

  async function doLogin(e) {
    e.preventDefault();
    showMsg('');
    btn.disabled = true;

    const role = (roleSelect.value || '').toLowerCase();
    const username = (usernameField.value || '').trim();
    const password = passwordField.value || '';

    if (!role || !username || !password) {
      showMsg('Preencha todos os campos.', true);
      btn.disabled = false;
      return;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, username, password }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        data = { ok: false, message: `Erro ${res.status}` };
      }

      if (!res.ok || !data.ok) {
        showMsg(data?.message || 'Falha no login.', true);
        btn.disabled = false;
        return;
      }

      localStorage.setItem('siatAuth', JSON.stringify({
        role: data.role,
        user: data.user,
        token: data.token,
        ts: Date.now(),
      }));

      // Redireciona conforme o perfil
      window.location.href = data.role === 'administrador' ? '/adm' : '/home';
    } catch (err) {
      console.error(err);
      showMsg('Erro de rede ao fazer login.', true);
      btn.disabled = false;
    }
  }

  form.addEventListener('submit', doLogin);
  passwordField.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') form.requestSubmit();
  });
});
