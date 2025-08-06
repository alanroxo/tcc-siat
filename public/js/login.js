document.getElementById('btnLogin').addEventListener('click', function() {
  const role = document.getElementById('roleSelect').value;

  if (role === "conselheiro") {
    window.location.href = "pages/home.html";
  } else if (role === "administrador") {
    window.location.href = "pages/home_administrador.html";
  } else {
    alert("Por favor, selecione um perfil.");
  }
});
