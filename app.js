const express = require('express');
const bodyParser = require('body-parser');
const expressLayouts = require('express-ejs-layouts');
const siatRoutes = require('./routes/siat');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações do EJS
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
//app.use(expressLayouts);

// Middlewares para pegar dados do formulário
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware para servir arquivos estáticos da pasta public
app.use(express.static('public'));

// Rotas
app.use('/', siatRoutes);

// Inicialização do servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
