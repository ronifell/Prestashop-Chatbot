# 🚀 VPS Deployment Guide - MIA Chatbot

Complete guide to deploy the MIA chatbot on your VPS using GitHub.

## 📋 VPS Information

- **IP:** 212.227.108.25
- **SSH User:** ronifell
- **SSH Password:** PoQV81fUNgSDgCis4c4

---

## 🔧 Step 1: Connect to VPS

```bash
ssh ronifell@212.227.108.25
# When prompted for password, enter: PoQV81fUNgSDgCis4c4
```

---

## 📦 Step 2: Update the System

```bash
# Update package list
sudo apt update

# Upgrade installed packages
sudo apt upgrade -y

# Install basic tools
sudo apt install -y curl wget git build-essential
```

---

## 🟢 Step 3: Install Node.js 18+

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x or higher
npm --version
```

---

## 🐘 Step 4: Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Verify it's running
sudo systemctl status postgresql

# If not active, start it
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

---

## 🗄️ Step 5: Configure Database

```bash
# Switch to postgres user
sudo -u postgres psql
```

Inside PostgreSQL, execute:

```sql
-- Create database
CREATE DATABASE mundomascotix_chatbot;

-- Create user
CREATE USER mundomascotix_user WITH PASSWORD 'ChangeThisPassword123!';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE mundomascotix_chatbot TO mundomascotix_user;

-- Exit PostgreSQL
\q
```

Now install the required extensions:

```bash
# Install PostgreSQL extensions
sudo -u postgres psql -d mundomascotix_chatbot -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
sudo -u postgres psql -d mundomascotix_chatbot -c "CREATE EXTENSION IF NOT EXISTS uuid-ossp;"
```

---

## 📥 Step 6: Clone Repository from GitHub

```bash
# Navigate to directory where you want the project (example: /var/www)
cd /var/www

# If directory doesn't exist, create it
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www

# Clone the repository (replace with your GitHub URL)
git clone https://github.com/your-username/mundomascotixIA.git

# Or if it's private and you need authentication:
# git clone https://your-username:your-token@github.com/your-username/mundomascotixIA.git

cd mundomascotixIA
```

**Note:** If your repository is private, you'll need:
- A GitHub personal access token, or
- Configure SSH keys on the VPS

---

## 🔐 Step 7: Configure Environment Variables

```bash
# Go to backend directory
cd backend

# Copy example file
cp env.example .env

# Edit the .env file
nano .env
```

Configure the `.env` file with these values:

```env
# ============================================================
# SERVER CONFIGURATION
# ============================================================
PORT=3001
NODE_ENV=production

# ============================================================
# DATABASE CONFIGURATION
# ============================================================
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mundomascotix_chatbot
DB_USER=mundomascotix_user
DB_PASSWORD=ChangeThisPassword123!

# ============================================================
# OPENAI CONFIGURATION
# ============================================================
OPENAI_API_KEY=sk-your-real-openai-api-key
OPENAI_MODEL=gpt-4o
OPENAI_MAX_TOKENS=800
OPENAI_TEMPERATURE=0.4

# ============================================================
# FRONTEND URL (CORS)
# ============================================================
# VPS URL where frontend will be served
FRONTEND_URL=http://212.227.108.25:3001

# ============================================================
# PRESTASHOP CONFIGURATION
# ============================================================
PRESTASHOP_URL=https://mundomascotix.com
PRESTASHOP_API_KEY=your_prestashop_api_key
```

**Important:** 
- Replace `ChangeThisPassword123!` with the password you used when creating the PostgreSQL user
- Replace `sk-your-real-openai-api-key` with your real OpenAI API key
- Save the file with `Ctrl+O`, then `Enter`, then `Ctrl+X`

---

## 📚 Step 8: Install Dependencies

```bash
# Install backend dependencies
cd /var/www/mundomascotixIA/backend
npm install --production

# Install frontend dependencies
cd ../frontend
npm install
```

---

## 🗃️ Step 9: Initialize Database

```bash
cd /var/www/mundomascotixIA/backend

# Initialize database (creates tables, triggers, initial data)
npm run db:init
```

This will create all tables, full-text search triggers, initial red flags, system prompt, and FAQs.

---

## 📊 Step 10: Import Data (Optional)

If you have data to import:

```bash
cd /var/www/mundomascotixIA/backend

# Import products from Excel
npm run import:products -- /path/to/catalog.xlsx

# Import clinics from Excel
npm run import:clinics -- /path/to/clinics.xlsx

# Import vademecums from PDF folder
npm run import:vademecums -- /path/to/pdfs-folder/
```

---

## 🏗️ Step 11: Build Frontend

```bash
cd /var/www/mundomascotixIA/frontend

# Build for production
npm run build
```

This will generate files in `frontend/dist/` that will be served by the backend.

---

## 🔄 Step 12: Install and Configure PM2

PM2 is a process manager for Node.js that keeps the application running.

```bash
# Install PM2 globally
sudo npm install -g pm2

# Create PM2 configuration file
cd /var/www/mundomascotixIA/backend
nano ecosystem.config.js
```

Paste this configuration:

```javascript
module.exports = {
  apps: [{
    name: 'mia-chatbot',
    script: 'src/index.js',
    cwd: '/var/www/mundomascotixIA/backend',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '500M',
    watch: false
  }]
};
```

Save the file (`Ctrl+O`, `Enter`, `Ctrl+X`).

Now start the application:

```bash
# Start with PM2
pm2 start ecosystem.config.js

# View status
pm2 status

# View real-time logs
pm2 logs mia-chatbot

# Save configuration to start automatically on server reboot
pm2 save
pm2 startup
```

The last command (`pm2 startup`) will give you a command to execute. Copy and run it.

---

## 🔥 Step 13: Configure Firewall

```bash
# Allow port 3001 (backend)
sudo ufw allow 3001/tcp

# Allow SSH (important, don't close this)
sudo ufw allow 22/tcp

# If you're going to use Nginx later
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Verify status
sudo ufw status
```

---

## ✅ Step 14: Verify Deployment

```bash
# Verify PM2 is running
pm2 status

# View logs
pm2 logs mia-chatbot --lines 50

# Test health endpoint
curl http://localhost:3001/api/chat/health
```

You should see a JSON response with the service status.

You can also test from your browser:
```
http://212.227.108.25:3001/api/chat/health
```

---

## 🌐 Step 15: Configure Nginx (Optional but Recommended)

Nginx can act as a reverse proxy and allow HTTPS usage.

```bash
# Install Nginx
sudo apt install -y nginx

# Create configuration
sudo nano /etc/nginx/sites-available/mia-chatbot
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name 212.227.108.25;

    # Logs
    access_log /var/log/nginx/mia-chatbot-access.log;
    error_log /var/log/nginx/mia-chatbot-error.log;

    # Proxy to backend
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Save and enable the site:

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/mia-chatbot /etc/nginx/sites-enabled/

# Remove default configuration (optional)
sudo rm /etc/nginx/sites-enabled/default

# Verify configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Verify it's running
sudo systemctl status nginx
```

Now you can access the API through Nginx:
```
http://212.227.108.25/api/chat/health
```

---

## 🔒 Step 16: Configure HTTPS with Let's Encrypt (Optional)

If you have a domain pointing to the VPS:

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com

# Auto-renewal (configured automatically)
sudo certbot renew --dry-run
```

---

## 🔄 Step 17: Update Code from GitHub

When you need to update the code:

```bash
cd /var/www/mundomascotixIA

# Get latest changes
git pull origin main  # or 'master' depending on your branch

# If there are changes in backend dependencies
cd backend
npm install --production

# If there are changes in frontend dependencies
cd ../frontend
npm install
npm run build

# Restart application
pm2 restart mia-chatbot

# View logs to verify
pm2 logs mia-chatbot --lines 50
```

---

## 📝 Step 18: Generate PrestaShop Snippets

After building, generate updated snippets:

```bash
cd /var/www/mundomascotixIA/prestashop-integration

# Generate snippets with VPS URL
node generate-snippets.js http://212.227.108.25:3001
```

This will create:
- `mia-homepage-snippet-generated.tpl`
- `mia-internal-snippet-generated.tpl`

Copy these files to your PrestaShop theme.

---

## 🐛 Troubleshooting

### Backend won't start

```bash
# View PM2 logs
pm2 logs mia-chatbot

# Verify PostgreSQL is running
sudo systemctl status postgresql

# Verify environment variables
cd /var/www/mundomascotixIA/backend
cat .env

# Test database connection manually
sudo -u postgres psql -d mundomascotix_chatbot -c "SELECT 1;"
```

### CORS Error

- Verify that `PRESTASHOP_URL` in `.env` is correct
- Verify that PrestaShop domain is allowed in `backend/src/index.js`

### Frontend files won't load

```bash
# Verify build completed
ls -la /var/www/mundomascotixIA/frontend/dist/

# Verify permissions
sudo chown -R $USER:$USER /var/www/mundomascotixIA
```

### Database won't connect

```bash
# Verify user has permissions
sudo -u postgres psql -c "\du"

# Verify database exists
sudo -u postgres psql -l | grep mundomascotix

# Test connection
psql -h localhost -U mundomascotix_user -d mundomascotix_chatbot
```

### PM2 won't start automatically

```bash
# Regenerate startup script
pm2 startup

# Save current configuration
pm2 save
```

---

## 📊 Useful PM2 Commands

```bash
# View status
pm2 status

# View logs
pm2 logs mia-chatbot

# Restart
pm2 restart mia-chatbot

# Stop
pm2 stop mia-chatbot

# Delete from PM2
pm2 delete mia-chatbot

# Real-time monitoring
pm2 monit
```

---

## 🔍 Final Verification

Verify everything works:

1. **Backend responds:**
   ```bash
   curl http://localhost:3001/api/chat/health
   ```

2. **Frontend loads:**
   - Open in browser: `http://212.227.108.25:3001`
   - You should see the chatbot

3. **API works:**
   ```bash
   curl -X POST http://localhost:3001/api/chat \
     -H "Content-Type: application/json" \
     -d '{"sessionId":"test","message":"Hello"}'
   ```

4. **No errors in logs:**
   ```bash
   pm2 logs mia-chatbot --lines 100 | grep -i error
   ```

---

## 📚 Additional Resources

- **Application logs:** `backend/logs/`
- **PM2 logs:** `backend/logs/pm2-*.log`
- **Nginx logs:** `/var/log/nginx/`
- **PM2 configuration:** `backend/ecosystem.config.js`
- **Environment variables:** `backend/.env`

---

## ✅ Deployment Checklist

- [ ] VPS updated and tools installed
- [ ] Node.js 18+ installed
- [ ] PostgreSQL installed and configured
- [ ] Database created with extensions
- [ ] Repository cloned from GitHub
- [ ] Environment variables configured
- [ ] Dependencies installed
- [ ] Database initialized
- [ ] Data imported (if applicable)
- [ ] Frontend built
- [ ] PM2 configured and application running
- [ ] Firewall configured
- [ ] Nginx configured (optional)
- [ ] HTTPS configured (optional)
- [ ] Snippets generated for PrestaShop
- [ ] Everything verified and working

---

Your MIA chatbot should now be running in production! 🎉
