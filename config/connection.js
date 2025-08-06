// config/connection.js

// Para evitar erro, deixe essa conexão "falsa" temporária
module.exports = {
  query: (sql, params, callback) => {
    // aqui pode deixar vazio ou chamar callback com resultado falso
    callback(null, []);
  }
};
