# 🐙 GitHub + Atualização do Servidor

## Fluxo de trabalho

```
Seu PC  →  git push  →  GitHub  →  git pull no servidor  →  docker compose restart
```

---

## 1. Criar repositório no GitHub

1. Acesse https://github.com/new
2. Nome: `ranking-operadores`
3. **Private** (recomendado — contém senhas no docker-compose)
4. Não marque nenhum checkbox (README, .gitignore)
5. Clique **Create repository**

---

## 2. Configurar Git no seu PC (onde estão os arquivos)

```bash
cd ranking-app/

# Iniciar repositório local
git init
git add .
git commit -m "primeiro commit"

# Conectar ao GitHub (copie a URL do seu repo)
git remote add origin https://github.com/SEU_USUARIO/ranking-operadores.git
git branch -M main
git push -u origin main
```

---

## 3. Configurar o servidor para puxar do GitHub

```bash
# No servidor via SSH
ssh endriusp@ranking.gate7it.net.br

# Instalar git se não tiver
sudo apt install -y git

# Entrar na pasta do projeto
cd /home/endriusp/

# Remover a pasta atual e clonar do GitHub
# (faça backup do .env antes!)
cp ranking-app/docker-compose.yml ~/docker-compose.yml.bkp

# Clonar o repositório
git clone https://github.com/SEU_USUARIO/ranking-operadores.git ranking-app-git

# Copiar o docker-compose com suas senhas para o novo clone
cp ~/docker-compose.yml.bkp ranking-app-git/docker-compose.yml

# Substituir a pasta antiga
cd ranking-app-git
docker compose up -d
```

---

## 4. Fluxo de atualização (rotina)

### No seu PC — fazer uma alteração

```bash
cd ranking-app/

# 1. Editar o arquivo que quiser (ex: public/index.html)
nano public/index.html

# 2. Ver o que mudou
git status
git diff

# 3. Commitar e enviar
git add .
git commit -m "descrição do que mudou"
git push
```

### No servidor — aplicar a atualização

```bash
ssh endriusp@ranking.gate7it.net.br
cd /home/endriusp/ranking-app

# Puxar alterações do GitHub
git pull

# Reconstruir e reiniciar o container
docker compose up -d --build

# Verificar se subiu ok
docker compose logs --tail=20
```

---

## 5. Script de atualização automática (opcional)

Crie um script no servidor para fazer tudo com 1 comando:

```bash
nano /home/endriusp/update-ranking.sh
```

Cole:
```bash
#!/bin/bash
echo "🔄 Atualizando Ranking Operadores..."
cd /home/endriusp/ranking-app
git pull
docker compose up -d --build
echo "✅ Pronto! $(docker compose ps --format 'table {{.Name}}\t{{.Status}}')"
```

Torna executável:
```bash
chmod +x /home/endriusp/update-ranking.sh
```

Para atualizar, basta rodar:
```bash
./update-ranking.sh
```

---

## 6. Proteger senhas no GitHub

O `docker-compose.yml` tem suas senhas. Para não expor no GitHub:

**Opção A — Repo privado** (mais simples, já fizemos)

**Opção B — Usar arquivo .env separado**

No `docker-compose.yml`, troque as variáveis fixas por referência ao `.env`:
```yaml
environment:
  - PORT=${PORT}
  - ADMIN_USER=${ADMIN_USER}
  - ADMIN_PASS=${ADMIN_PASS}
  - SESSION_SECRET=${SESSION_SECRET}
```

Crie `.env` no servidor (nunca commitar esse arquivo):
```bash
nano /home/endriusp/ranking-app/.env
```
```
PORT=3000
ADMIN_USER=admin
ADMIN_PASS=SuaSenha
SESSION_SECRET=sua-chave-secreta
```

O `.gitignore` já tem `.env` listado — ele não vai pro GitHub.

---

## 7. Resumo visual

```
┌─────────────┐     git push      ┌──────────┐
│  Seu PC     │ ───────────────►  │  GitHub  │
│  (edita)    │                   │ (storage)│
└─────────────┘                   └──────────┘
                                       │
                                  git pull
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  Ubuntu Server  │
                              │  docker compose │
                              │  up -d --build  │
                              └─────────────────┘
                                       │
                              ┌─────────────────┐
                              │  ranking.gate7  │
                              │  it.net.br  📺  │
                              └─────────────────┘
```

---

## Comandos rápidos de referência

| O que fazer | Comando (servidor) |
|---|---|
| Atualizar do GitHub | `git pull && docker compose up -d --build` |
| Ver logs em tempo real | `docker compose logs -f` |
| Reiniciar sem rebuild | `docker compose restart` |
| Ver status | `docker compose ps` |
| Backup do banco | `docker cp ranking-operadores:/app/data/ranking.db ~/backup-$(date +%Y%m%d).db` |
| Ver banco de dados | `docker exec -it ranking-operadores sqlite3 /app/data/ranking.db "SELECT * FROM operators;"` |
