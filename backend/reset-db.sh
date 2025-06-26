#!/bin/bash
# backend/brutal-reset.sh - Reset completo e definitivo

echo "💀 RESET BRUTALE DATABASE"
echo "========================="

# Vai nella directory corretta
cd "$(dirname "$0")"

echo "📍 Directory: $(pwd)"

# 1. Determina le credenziali PostgreSQL
echo "🔍 Determinazione credenziali PostgreSQL..."

# Prova a leggere dal config
if [ -f "src/config/config.json" ]; then
    DB_USER=$(grep -o '"username"[[:space:]]*:[[:space:]]*"[^"]*' src/config/config.json | grep -o '"[^"]*"

# 5. Ricrea struttura completa
echo "🏗️ Creazione struttura database..."
npx sequelize-cli db:migrate

if [ $? -eq 0 ]; then
    echo "✅ Struttura creata"
else
    echo "❌ Errore creazione struttura"
    exit 1
fi

# 7. Verifica struttura creata
NEW_TABLE_COUNT=$($PSQL_CMD -d attendance_system -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d ' ')
echo "🔍 Tabelle create: $NEW_TABLE_COUNT"

# 8. Inserisci dati di test
echo "🌱 Inserimento dati di test..."
npx sequelize-cli db:seed:all

if [ $? -eq 0 ]; then
    echo "✅ Dati di test inseriti"
else
    echo "❌ Errore inserimento dati"
    exit 1
fi

# 9. Verifica finale
echo "🧪 Verifica finale..."
USER_COUNT=$($PSQL_CMD -d attendance_system -t -c 'SELECT COUNT(*) FROM "Users";' 2>/dev/null | tr -d ' ' || echo "0")
echo "   Utenti inseriti: $USER_COUNT"

# Pulizia variabile password
unset PGPASSWORD

echo ""
echo "🎉 RESET BRUTALE COMPLETATO!"
echo ""
echo "📊 STATO FINALE:"
echo "  📋 Tabelle: $NEW_TABLE_COUNT"
echo "  👤 Utenti: $USER_COUNT"
echo ""
echo "🚀 PROSSIMI PASSI:"
echo "  1. npm run dev"
echo "  2. Test login admin@test.com / password"
echo "  3. Test sistema BLOB"
echo ""
echo "💡 Il database è ora completamente pulito e pronto!"
 | tr -d '"' | head -1)
    DB_PASSWORD=$(grep -o '"password"[[:space:]]*:[[:space:]]*"[^"]*' src/config/config.json | grep -o '"[^"]*"

# 5. Ricrea struttura completa
echo "🏗️ Creazione struttura database..."
npx sequelize-cli db:migrate

if [ $? -eq 0 ]; then
    echo "✅ Struttura creata"
else
    echo "❌ Errore creazione struttura"
    exit 1
fi

# 6. Verifica struttura creata
NEW_TABLE_COUNT=$(psql -d attendance_system -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")
echo "🔍 Tabelle create: $NEW_TABLE_COUNT"

# 7. Inserisci dati di test
echo "🌱 Inserimento dati di test..."
npx sequelize-cli db:seed:all

if [ $? -eq 0 ]; then
    echo "✅ Dati di test inseriti"
else
    echo "❌ Errore inserimento dati"
    exit 1
fi

# 8. Verifica finale
echo "🧪 Verifica finale..."
USER_COUNT=$(psql -d attendance_system -t -c 'SELECT COUNT(*) FROM "Users";' 2>/dev/null || echo "0")
echo "   Utenti inseriti: $USER_COUNT"

echo ""
echo "🎉 RESET BRUTALE COMPLETATO!"
echo ""
echo "📊 STATO FINALE:"
echo "  📋 Tabelle: $NEW_TABLE_COUNT"
echo "  👤 Utenti: $USER_COUNT"
echo ""
echo "🚀 PROSSIMI PASSI:"
echo "  1. npm run dev"
echo "  2. Test login admin@test.com / password"
echo "  3. Test sistema BLOB"
echo ""
echo "💡 Il database è ora completamente pulito e pronto!"
 | tr -d '"' | head -1)
    DB_HOST=$(grep -o '"host"[[:space:]]*:[[:space:]]*"[^"]*' src/config/config.json | grep -o '"[^"]*"

# 5. Ricrea struttura completa
echo "🏗️ Creazione struttura database..."
npx sequelize-cli db:migrate

if [ $? -eq 0 ]; then
    echo "✅ Struttura creata"
else
    echo "❌ Errore creazione struttura"
    exit 1
fi

# 6. Verifica struttura creata
NEW_TABLE_COUNT=$(psql -d attendance_system -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")
echo "🔍 Tabelle create: $NEW_TABLE_COUNT"

# 7. Inserisci dati di test
echo "🌱 Inserimento dati di test..."
npx sequelize-cli db:seed:all

if [ $? -eq 0 ]; then
    echo "✅ Dati di test inseriti"
else
    echo "❌ Errore inserimento dati"
    exit 1
fi

# 8. Verifica finale
echo "🧪 Verifica finale..."
USER_COUNT=$(psql -d attendance_system -t -c 'SELECT COUNT(*) FROM "Users";' 2>/dev/null || echo "0")
echo "   Utenti inseriti: $USER_COUNT"

echo ""
echo "🎉 RESET BRUTALE COMPLETATO!"
echo ""
echo "📊 STATO FINALE:"
echo "  📋 Tabelle: $NEW_TABLE_COUNT"
echo "  👤 Utenti: $USER_COUNT"
echo ""
echo "🚀 PROSSIMI PASSI:"
echo "  1. npm run dev"
echo "  2. Test login admin@test.com / password"
echo "  3. Test sistema BLOB"
echo ""
echo "💡 Il database è ora completamente pulito e pronto!"
 | tr -d '"' | head -1)
    DB_PORT=$(grep -o '"port"[[:space:]]*:[[:space:]]*[0-9]*' src/config/config.json | grep -o '[0-9]*

# 5. Ricrea struttura completa
echo "🏗️ Creazione struttura database..."
npx sequelize-cli db:migrate

if [ $? -eq 0 ]; then
    echo "✅ Struttura creata"
else
    echo "❌ Errore creazione struttura"
    exit 1
fi

# 6. Verifica struttura creata
NEW_TABLE_COUNT=$(psql -d attendance_system -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")
echo "🔍 Tabelle create: $NEW_TABLE_COUNT"

# 7. Inserisci dati di test
echo "🌱 Inserimento dati di test..."
npx sequelize-cli db:seed:all

if [ $? -eq 0 ]; then
    echo "✅ Dati di test inseriti"
else
    echo "❌ Errore inserimento dati"
    exit 1
fi

# 8. Verifica finale
echo "🧪 Verifica finale..."
USER_COUNT=$(psql -d attendance_system -t -c 'SELECT COUNT(*) FROM "Users";' 2>/dev/null || echo "0")
echo "   Utenti inseriti: $USER_COUNT"

echo ""
echo "🎉 RESET BRUTALE COMPLETATO!"
echo ""
echo "📊 STATO FINALE:"
echo "  📋 Tabelle: $NEW_TABLE_COUNT"
echo "  👤 Utenti: $USER_COUNT"
echo ""
echo "🚀 PROSSIMI PASSI:"
echo "  1. npm run dev"
echo "  2. Test login admin@test.com / password"
echo "  3. Test sistema BLOB"
echo ""
echo "💡 Il database è ora completamente pulito e pronto!"
 | head -1)
else
    DB_USER="postgres"
    DB_PASSWORD="password"
    DB_HOST="localhost"
    DB_PORT="5432"
fi

# Fallback per valori vuoti
DB_USER=${DB_USER:-postgres}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

echo "   🔧 User: $DB_USER"
echo "   🔧 Host: $DB_HOST"
echo "   🔧 Port: $DB_PORT"

# Imposta PGPASSWORD se disponibile
if [ ! -z "$DB_PASSWORD" ] && [ "$DB_PASSWORD" != "null" ]; then
    export PGPASSWORD="$DB_PASSWORD"
    echo "   🔧 Password: ***"
fi

# Comandi base psql con credenziali
PSQL_CMD="psql -h $DB_HOST -p $DB_PORT -U $DB_USER"
PSQL_DEFAULT_DB="$PSQL_CMD -d postgres"

# 2. Test connessione
echo "🔌 Test connessione PostgreSQL..."
$PSQL_DEFAULT_DB -c "SELECT version();" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Connessione PostgreSQL OK"
else
    echo "❌ Errore connessione PostgreSQL"
    echo "💡 Verifica che PostgreSQL sia in esecuzione:"
    echo "   brew services start postgresql"
    echo "   brew services start postgresql@14"
    exit 1
fi

# 3. Termina connessioni esistenti
echo "🔌 Terminazione connessioni al database..."
$PSQL_DEFAULT_DB -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'attendance_system' AND pid <> pg_backend_pid();
" 2>/dev/null || echo "⚠️ Non ci sono connessioni da terminare"

# 4. Drop completo database
echo "💥 Eliminazione completa database..."
$PSQL_DEFAULT_DB -c "DROP DATABASE IF EXISTS attendance_system;" 

if [ $? -eq 0 ]; then
    echo "✅ Database eliminato"
else
    echo "❌ Errore eliminazione database"
    exit 1
fi

# 5. Ricrea database vuoto
echo "🔧 Ricreazione database vuoto..."
$PSQL_DEFAULT_DB -c "CREATE DATABASE attendance_system;"

if [ $? -eq 0 ]; then
    echo "✅ Database ricreato"
else
    echo "❌ Errore ricreazione database"
    exit 1
fi

# 6. Verifica che il database sia vuoto
echo "🔍 Verifica database vuoto..."
TABLE_COUNT=$($PSQL_CMD -d attendance_system -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d ' ')
echo "   Tabelle esistenti: $TABLE_COUNT"

# 5. Ricrea struttura completa
echo "🏗️ Creazione struttura database..."
npx sequelize-cli db:migrate

if [ $? -eq 0 ]; then
    echo "✅ Struttura creata"
else
    echo "❌ Errore creazione struttura"
    exit 1
fi

# 6. Verifica struttura creata
NEW_TABLE_COUNT=$(psql -d attendance_system -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")
echo "🔍 Tabelle create: $NEW_TABLE_COUNT"

# 7. Inserisci dati di test
echo "🌱 Inserimento dati di test..."
npx sequelize-cli db:seed:all

if [ $? -eq 0 ]; then
    echo "✅ Dati di test inseriti"
else
    echo "❌ Errore inserimento dati"
    exit 1
fi

# 8. Verifica finale
echo "🧪 Verifica finale..."
USER_COUNT=$(psql -d attendance_system -t -c 'SELECT COUNT(*) FROM "Users";' 2>/dev/null || echo "0")
echo "   Utenti inseriti: $USER_COUNT"

echo ""
echo "🎉 RESET BRUTALE COMPLETATO!"
echo ""
echo "📊 STATO FINALE:"
echo "  📋 Tabelle: $NEW_TABLE_COUNT"
echo "  👤 Utenti: $USER_COUNT"
echo ""
echo "🚀 PROSSIMI PASSI:"
echo "  1. npm run dev"
echo "  2. Test login admin@test.com / password"
echo "  3. Test sistema BLOB"
echo ""
echo "💡 Il database è ora completamente pulito e pronto!"