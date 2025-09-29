SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

CREATE DATABASE IF NOT EXISTS siatdb
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE siatdb;

-- -------- criancas --------
CREATE TABLE IF NOT EXISTS criancas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  data_nascimento DATE NOT NULL,
  cpf VARCHAR(14) NULL UNIQUE,
  genero ENUM('masculino','feminino','outros') NOT NULL,
  comorbidade ENUM('nenhuma','asma','diabetes','hipertensao','outros') NOT NULL DEFAULT 'nenhuma',
  escolaridade ENUM('fundamental','medio','superior') NOT NULL,
  status ENUM('ativo','acompanhamento','inativo') NOT NULL DEFAULT 'ativo',
  foto_crianca VARCHAR(255) NULL,
  observacoes_crianca TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_criancas_nome (nome),
  KEY idx_criancas_status (status),
  KEY idx_criancas_data_nasc (data_nascimento),
  KEY idx_criancas_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------- enderecos (1:1 com criancas) --------
CREATE TABLE IF NOT EXISTS enderecos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  crianca_id INT UNSIGNED NOT NULL,
  uf CHAR(2) NOT NULL,
  cidade VARCHAR(100) NOT NULL,
  bairro VARCHAR(120) NOT NULL,
  rua VARCHAR(150) NOT NULL,
  numero INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_enderecos_crianca (crianca_id),
  KEY idx_enderecos_cidade (cidade),
  CONSTRAINT fk_enderecos_criancas
    FOREIGN KEY (crianca_id) REFERENCES criancas(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------- responsaveis --------
CREATE TABLE IF NOT EXISTS responsaveis (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  crianca_id INT UNSIGNED NOT NULL,
  nome_responsavel VARCHAR(150) NOT NULL,
  data_nascimento_responsavel DATE NOT NULL,
  ocupacao VARCHAR(120) NOT NULL,
  estado_civil_responsavel ENUM('solteiro','casado','divorciado','viuvo') NOT NULL,
  genero_responsavel ENUM('masculino','feminino','outros') NOT NULL,
  telefone_responsavel VARCHAR(30) NOT NULL,
  email_responsavel VARCHAR(150) NOT NULL,
  foto_responsavel VARCHAR(255) NULL,
  observacao_responsavel TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_responsaveis_crianca (crianca_id),
  KEY idx_responsaveis_nome (nome_responsavel),
  KEY idx_responsaveis_email (email_responsavel),
  KEY idx_responsaveis_tel (telefone_responsavel),
  CONSTRAINT fk_responsaveis_criancas
    FOREIGN KEY (crianca_id) REFERENCES criancas(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------- ocorrencias --------
CREATE TABLE IF NOT EXISTS ocorrencias (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  crianca_id INT UNSIGNED NULL,
  nome VARCHAR(120) NOT NULL,
  data DATE NOT NULL,
  tipo ENUM('comportamento','saude','ensino','outro') NOT NULL,
  status ENUM('pendente','andamento','resolvido') NOT NULL DEFAULT 'pendente',
  descricao TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_ocorrencias_data (data),
  KEY idx_ocorrencias_status (status),
  KEY idx_ocorrencias_tipo (tipo),
  KEY idx_ocorrencias_crianca (crianca_id),
  KEY idx_ocorrencias_created (created_at),
  CONSTRAINT fk_ocorrencias_criancas
    FOREIGN KEY (crianca_id) REFERENCES criancas(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------- contas --------
CREATE TABLE IF NOT EXISTS contas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL UNIQUE,
  senha VARCHAR(255) NOT NULL,
  tipo ENUM('conselheiro','adm') NOT NULL DEFAULT 'conselheiro',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_contas_nome (nome),
  KEY idx_contas_tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------- contas iniciais --------
INSERT INTO contas (nome, senha, tipo) VALUES
('Luan', '123123', 'conselheiro'),
('Alan', '123456', 'conselheiro'),
('AdmSiat', '123123@', 'adm');
