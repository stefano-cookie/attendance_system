#!/bin/bash

# backend/run_fixes_real_db.sh
# Script aggiornato per il database reale

echo "🔧 FIX SISTEMA AUTH PER DATABASE REALE"
echo "======================================"
echo ""

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funzione per attendere input
wait_for_input() {
    echo ""
    echo -e "${YELLOW}Premi ENTER per continuare...${NC}"
    read
}

echo -e "${BLUE}INFO: Il tuo database ha:${NC}"
echo "- Campo password: 'password' (non 'passwordHash')"
echo "- Admin: admin@test.com"
echo "- Teacher: teacher@university.it"
echo "- Student: stefanojpriolo@gmail.com"
echo ""
wait_for_input

# 1. Copia il file authRoutes.js corretto
echo -e "${GREEN}STEP 1: Aggiornamento authRoutes.js${NC}"
echo "-------------------------------------"
echo "Assicurati di aver copiato il file authRoutes.js dall'artifact 'fix-auth-routes-real'"
echo "in backend/src/routes/authRoutes.js"
wait_for_input

# 2. Reset password utenti
echo -e "${GREEN}STEP 2: Reset password utenti${NC}"
echo "-----------------------------"
node check_and_reset_passwords.js
wait_for_input

# 3. Test credenziali reali
echo -e "${GREEN}STEP 3: Test credenziali reali${NC}"
echo "------------------------------"
node test_real_credentials.js
wait_for_input

echo ""
echo -e "${GREEN}✅ FIX COMPLETATI!${NC}"
echo ""
echo -e "${BLUE}PROSSIMI PASSI:${NC}"
echo "1. Se il backend è in esecuzione, fermalo (Ctrl+C) e riavvialo"
echo "2. Riavvia il backend: npm start"
echo "3. In un altro terminale, riavvia il frontend: cd ../frontend && npm start"
echo "4. Prova il login con:"
echo "   - Email: admin@test.com"
echo "   - Password: Admin123!"
echo ""
echo -e "${YELLOW}NOTA: Se le password non funzionano:${NC}"
echo "- Esegui: node check_and_reset_passwords.js"
echo "- Scegli opzione 4 per resettare tutte le password"
echo "- Le password di default saranno:"
echo "  - admin@test.com → Admin123!"
echo "  - teacher@university.it → Teacher123!"
echo "  - stefanojpriolo@gmail.com → Student123!"