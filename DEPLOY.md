# 🏆 Ranking Operadores — Guia de Deploy

## Estrutura do projeto
```
ranking-app/
├── server.js          ← Backend Node.js + SQLite
├── package.json
├── Dockerfile
├── docker-compose.yml
├── nginx.conf         ← Reverse proxy
├── .env.example
├── data/              ← Banco de dados (gerado automaticamente)
│   └── ranking.db
└── public/
    └── index.html     ← Frontend (TV layout + admin modal)
```

---

## 🐧 OPÇÃO 1: Ubuntu Server 25 (manual)

### 1. Instalar dependências

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar
node -v   # v20.x.x
npm -v    # 10.x.x
```

### 2. Copiar o projeto para o servidor

```bash
# No seu computador local — zipar e enviar
scp -r ./ranking-app usuario@IP_DO_SERVIDOR:/opt/ranking-app

# Ou clonar se tiver git
# git clone https://seu-repo/ranking-app /opt/ranking-app
```

### 3. Instalar dependências e configurar

```bash
cd /opt/ranking-app

# Instalar pacotes
npm install --production

# Criar arquivo .env
cp .env.example .env
nano .env
# → Troque ADMIN_PASS e SESSION_SECRET
```

### 4. Rodar com PM2 (process manager — reinicia automático)

```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Iniciar o app
pm2 start server.js --name ranking-operadores

# Salvar para reiniciar no boot
pm2 startup
pm2 save

# Verificar status
pm2 status
pm2 logs ranking-operadores
```

### 5. Configurar Nginx (proxy reverso)

```bash
sudo apt install -y nginx

# Copiar config
sudo cp /opt/ranking-app/nginx.conf /etc/nginx/sites-available/ranking

# Editar domínio ou IP
sudo nano /etc/nginx/sites-available/ranking
# Troque: server_name ranking.seudominio.com.br;
# Por:    server_name SEU_IP_OU_DOMINIO;

# Ativar site
sudo ln -s /etc/nginx/sites-available/ranking /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL com Let's Encrypt (opcional, precisa de domínio)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ranking.seudominio.com.br

# Descomente o bloco HTTPS no nginx.conf depois disso
```

### 7. Acessar

```
http://SEU_IP        ← Dashboard TV
http://SEU_IP        ← Clique em "⚙ Admin" para painel
```

### Comandos úteis PM2

```bash
pm2 restart ranking-operadores   # Reiniciar
pm2 stop ranking-operadores      # Parar
pm2 logs ranking-operadores      # Ver logs em tempo real
pm2 monit                        # Monitor visual
```

---

## 📦 OPÇÃO 2: Ubuntu Server + Docker (recomendado)

### 1. Instalar Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Fazer logout e login novamente
```

### 2. Copiar projeto e subir

```bash
scp -r ./ranking-app usuario@IP:/opt/ranking-app
cd /opt/ranking-app

# Editar senhas no docker-compose.yml
nano docker-compose.yml
# Troque: ADMIN_PASS e SESSION_SECRET

# Subir
docker compose up -d

# Ver logs
docker compose logs -f
```

### 3. Nginx na máquina host (igual ao passo 5 acima)

```bash
sudo apt install -y nginx
sudo cp nginx.conf /etc/nginx/sites-available/ranking
sudo ln -s /etc/nginx/sites-available/ranking /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Comandos Docker úteis

```bash
docker compose restart         # Reiniciar
docker compose down            # Parar
docker compose pull && docker compose up -d  # Atualizar
docker exec -it ranking-operadores sh        # Shell no container

# Ver o banco de dados
docker exec -it ranking-operadores sh
sqlite3 /app/data/ranking.db
.tables
SELECT * FROM operators;
.quit
```

---

## 🎛️ OPÇÃO 3: EasyPanel

### Pré-requisito
EasyPanel instalado em um VPS (Ubuntu):
```bash
curl -sSL https://get.easypanel.io | sh
```
Acesse: `http://SEU_IP:3000` para configurar o EasyPanel.

### Deploy no EasyPanel

1. **Acesse o EasyPanel** → Criar novo projeto: `ranking-operadores`

2. **Criar um App** → escolha **"Custom"** → **"Dockerfile"**

3. **Source**: faça upload do zip do projeto OU conecte um repositório Git

4. **Variáveis de ambiente** (aba Environment):
```
PORT=3000
ADMIN_USER=admin
ADMIN_PASS=SuaSenhaSuperSegura123
SESSION_SECRET=uma-string-aleatoria-bem-longa-aqui
NODE_ENV=production
```

5. **Volumes** (aba Volumes):
```
Mount Path: /app/data
```
Isso garante que o banco SQLite persiste entre deploys.

6. **Porta**: expor porta `3000`

7. **Domínio** (aba Domains):
   - Adicione seu domínio ou use o subdomínio do EasyPanel
   - Ative HTTPS automático (Let's Encrypt embutido)

8. Clique **Deploy** — EasyPanel faz o build e sobe automaticamente.

### Atualizar depois

Basta fazer push no repositório ou re-upload e clicar **"Redeploy"**.

---

## 🗄️ Banco de dados SQLite

O arquivo fica em `data/ranking.db`. É criado automaticamente na primeira execução.

### Ver dados via terminal

```bash
# Ubuntu direto
sqlite3 /opt/ranking-app/data/ranking.db

# Docker
docker exec -it ranking-operadores sqlite3 /app/data/ranking.db

# Comandos SQLite
.tables                          -- listar tabelas
SELECT * FROM operators;         -- ver operadores
SELECT * FROM config;            -- ver configurações
UPDATE operators SET score=3.5 WHERE name='Anderson';  -- editar manual
.quit
```

### Backup do banco

```bash
# Copiar o arquivo é suficiente!
cp /opt/ranking-app/data/ranking.db /backup/ranking-$(date +%Y%m%d).db

# Ou via Docker
docker cp ranking-operadores:/app/data/ranking.db ./backup-$(date +%Y%m%d).db
```

### Migrar para PostgreSQL no futuro

Se quiser escalar, o `server.js` pode ser adaptado trocando `better-sqlite3`
por `pg` (node-postgres) com mínimas alterações nas queries (todas já estão
em SQL padrão sem sintaxe específica do SQLite).

---

## 📺 Configuração para TV

Para a TV ficar sempre atualizada:

1. Abra o browser (Chrome/Firefox) no IP do servidor
2. Pressione **F11** para tela cheia
3. A página já faz **auto-refresh a cada 60 segundos** automaticamente
4. O ponto verde no canto superior direito indica que está ativo

### Evitar que a TV durma (Linux com HDMI)

```bash
# Desativar screensaver e sleep
xset s off
xset -dpms
xset s noblank

# Chrome em modo kiosk (tela cheia automático)
chromium-browser --kiosk http://localhost:3000
```

---

## 🔐 Segurança

- Troque `ADMIN_PASS` para uma senha forte
- Gere `SESSION_SECRET` aleatório:
  ```bash
  openssl rand -hex 32
  ```
- Configure firewall para liberar apenas porta 80/443:
  ```bash
  sudo ufw allow 22    # SSH
  sudo ufw allow 80    # HTTP
  sudo ufw allow 443   # HTTPS
  sudo ufw enable
  ```
- Não exponha a porta 3000 diretamente — use sempre o Nginx na frente

---

## 🚀 Resumo rápido (Docker)

```bash
# 1. Copiar projeto para servidor
scp -r ranking-app user@IP:/opt/ranking-app

# 2. Editar senha
nano /opt/ranking-app/docker-compose.yml

# 3. Subir
cd /opt/ranking-app && docker compose up -d

# 4. Acessar
# http://IP:3000
```

Pronto! 🎉
