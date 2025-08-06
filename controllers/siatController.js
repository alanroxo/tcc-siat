const connection = require('../config/connection'); // importe sua conexão MySQL

exports.showLogin = (req, res) => {
  res.render('login');
};

exports.loginUser = (req, res) => {
  const { username, password, role } = req.body;

  if (!role) {
    return res.status(400).send('Por favor, selecione um perfil.');
  }

  const sql = 'SELECT * FROM users WHERE email = ? AND role = ?';
  connection.query(sql, [username, role], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erro no servidor.');
    }
    if (results.length === 0) {
      return res.status(401).send('Usuário ou perfil inválido.');
    }

    const user = results[0];
    // ATENÇÃO: comparação simples, só pra testar!
    if (user.password === password) {
      if (role === 'conselheiro') {
        return res.redirect('/home');
      } else if (role === 'administrador') {
        return res.redirect('/home_administrador'); // crie essa rota se quiser
      } else {
        return res.status(400).send('Perfil inválido.');
      }
    } else {
      return res.status(401).send('Senha incorreta.');
    }
  });
};

exports.showHome = (req, res) => {
  res.render('home');
};