const express = require('express');
const router = express.Router();
const siatController = require('../controllers/siatController');

router.get('/login', siatController.showLogin);
router.post('/login', siatController.loginUser);

// Rota para a home (agora usando controller também)
router.get('/home', siatController.showHome);

// outras rotas...

module.exports = router;
