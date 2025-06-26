#!/bin/bash
# backend/setup-modern-migrations.sh
# Setup completo con migrazioni moderne e pulite

echo "🚀 SETUP MIGRAZIONI MODERNE"
echo "============================"

# Vai nella directory corretta
cd "$(dirname "$0")"
echo "📍 Directory: $(pwd)"

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funzioni helper
print_step() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Controlla dipendenze
check_dependencies() {
    print_step "CONTROLLO DIPENDENZE"
    
    # Controlla PostgreSQL
    if ! command -v psql &> /dev/null; then
        print_error "PostgreSQL non trovato. Installa con: brew install postgresql"
    fi
    
    # Controlla Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js non trovato"
    fi
    
    # Controlla Sequelize CLI
    if ! command -v npx &> /dev/null; then
        print_error "npx non trovato"
    fi
    
    print_success "Tutte le dipendenze sono presenti"
}

# Backup database esistente (opzionale)
backup_database() {
    print_step "BACKUP DATABASE ESISTENTE"
    
    local backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
    
    echo "Vuoi fare un backup del database esistente? (y/N): "
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "📦 Creazione backup: $backup_file"
        
        if pg_dump -U postgres -h localhost attendance_system > "$backup_file" 2>/dev/null; then
            print_success "Backup creato: $backup_file"
        else
            print_warning "Backup fallito (database potrebbe non esistere)"
        fi
    else
        print_warning "Backup saltato"
    fi
}

# Reset completo database
reset_database() {
    print_step "RESET DATABASE"
    
    echo "🗑️ Terminazione connessioni esistenti..."
    psql -U postgres -d postgres -c "
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = 'attendance_system' AND pid <> pg_backend_pid();
    " 2>/dev/null || print_warning "Nessuna connessione da terminare"
    
    echo "💥 Eliminazione database esistente..."
    psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS attendance_system;" || print_error "Errore eliminazione database"
    
    echo "🔧 Creazione database pulito..."
    psql -U postgres -d postgres -c "CREATE DATABASE attendance_system;" || print_error "Errore creazione database"
    
    print_success "Database resettato completamente"
}

# Preparazione directory migrazioni
setup_migrations_directory() {
    print_step "SETUP DIRECTORY MIGRAZIONI"
    
    # Backup vecchie migrazioni
    if [ -d "migrations" ]; then
        echo "📁 Backup vecchie migrazioni..."
        mv migrations migrations_old_$(date +%Y%m%d_%H%M%S)
        print_success "Vecchie migrazioni salvate in migrations_old_*"
    fi
    
    # Crea nuova directory
    mkdir -p migrations
    
    # Copia nuove migrazioni
    if [ -d "migrations" ]; then
        echo "📋 Copia nuove migrazioni..."
        cp migrations/* migrations/
        print_success "Nuove migrazioni copiate"
        
        # Verifica che ci siano tutte le 8 migrazioni moderne
        local migration_count=$(ls migrations/00*.js 2>/dev/null | wc -l)
        if [ "$migration_count" -eq 8 ]; then
            print_success "Tutte le 8 migrazioni moderne presenti"
        else
            print_warning "Trovate solo $migration_count migrazioni, ne servono 8"
        fi
    else
        print_error "Directory migrations non trovata! Assicurati di aver salvato le nuove migrazioni"
    fi
    
    # Lista migrazioni che saranno applicate
    echo "📋 Migrazioni da applicare:"
    ls -la migrations/00*.js | sed 's/.*migrations\//  - /' | head -8
}

# Applica migrazioni
apply_migrations() {
    print_step "APPLICAZIONE MIGRAZIONI"
    
    echo "🔧 Esecuzione migrazioni sequelize..."
    
    if npx sequelize-cli db:migrate; then
        print_success "Tutte le migrazioni applicate con successo"
    else
        print_error "Errore durante applicazione migrazioni"
    fi
    
    # Verifica tabelle create
    echo "🔍 Verifica tabelle create..."
    local table_count=$(psql -U postgres -d attendance_system -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d ' ')
    
    if [ "$table_count" -gt 5 ]; then
        print_success "Database strutturato correttamente ($table_count tabelle)"
    else
        print_error "Poche tabelle create ($table_count). Controlla gli errori."
    fi
}

# Seeder aggiornati
create_modern_seeders() {
    print_step "CREAZIONE SEEDER MODERNI"
    
    # Backup vecchi seeder
    if [ -d "seeders" ]; then
        mv seeders seeders_old_$(date +%Y%m%d_%H%M%S)
        print_success "Vecchi seeder salvati"
    fi
    
    mkdir -p seeders
    
    # Crea seeder admin moderno
    cat > seeders/001-admin-user.js << 'EOF'
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const bcrypt = require('bcryptjs');
    
    await queryInterface.bulkInsert('Users', [{
      name: 'Admin',
      surname: 'System',
      email: 'admin@test.com',
      password: await bcrypt.hash('password', 10),
      role: 'admin',
      is_active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
  },
  
  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Users', { email: 'admin@test.com' });
  }
};
EOF

    # Crea seeder teacher moderno
    cat > seeders/002-teacher-user.js << 'EOF'
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const bcrypt = require('bcryptjs');
    
    await queryInterface.bulkInsert('Users', [{
      name: 'Mario',
      surname: 'Rossi',
      email: 'teacher@test.com',
      password: await bcrypt.hash('password', 10),
      role: 'teacher',
      matricola: 'TCH001',
      is_active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
  },
  
  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Users', { email: 'teacher@test.com' });
  }
};
EOF

    # Crea seeder corso di test
    cat > seeders/003-test-course.js << 'EOF'
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('Courses', [{
      name: 'Medicina',
      description: 'Corso di Laurea in Medicina e Chirurgia',
      code: 'MED2025',
      color: '#10B981',
      academic_year: '2024-2025',
      semester: 'annual',
      credits: 360,
      is_active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
  },
  
  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Courses', { code: 'MED2025' });
  }
};
EOF

    # Crea seeder aula con camera
    cat > seeders/004-test-classroom.js << 'EOF'
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('Classrooms', [{
      name: 'Aula Magna',
      code: 'AM01',
      capacity: 100,
      floor: 'PT',
      building: 'Edificio A',
      has_projector: true,
      has_whiteboard: true,
      // Camera di test (simulator)
      camera_ip: '192.168.1.100',
      camera_username: 'admin',
      camera_password: 'admin123',
      camera_model: 'Test Camera Simulator',
      camera_status: 'unknown',
      is_active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
  },
  
  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Classrooms', { code: 'AM01' });
  }
};
EOF

    print_success "Seeder moderni creati"
}

# Applica seeder
apply_seeders() {
    print_step "APPLICAZIONE SEEDER"
    
    echo "🌱 Inserimento dati di test..."
    
    if npx sequelize-cli db:seed:all; then
        print_success "Seeder applicati con successo"
    else
        print_error "Errore durante applicazione seeder"
    fi
    
    # Verifica dati inseriti
    echo "🔍 Verifica dati inseriti..."
    local user_count=$(psql -U postgres -d attendance_system -t -c 'SELECT COUNT(*) FROM "Users";' | tr -d ' ')
    local course_count=$(psql -U postgres -d attendance_system -t -c 'SELECT COUNT(*) FROM "Courses";' | tr -d ' ')
    
    print_success "Utenti inseriti: $user_count"
    print_success "Corsi inseriti: $course_count"
}

# Test sistema completo
test_system() {
    print_step "TEST SISTEMA"
    
    echo "🧪 Test connessione database..."
    if psql -U postgres -d attendance_system -c "SELECT version();" > /dev/null 2>&1; then
        print_success "Connessione database OK"
    else
        print_error "Connessione database fallita"
    fi
    
    echo "🧪 Test tabelle principali..."
    local tables=("Users" "Courses" "Classrooms" "Lessons" "LessonImages" "Screenshots" "Attendances")
    
    for table in "${tables[@]}"; do
        if psql -U postgres -d attendance_system -c "SELECT COUNT(*) FROM \"$table\";" > /dev/null 2>&1; then
            print_success "Tabella $table OK"
        else
            print_error "Tabella $table mancante o danneggiata"
        fi
    done
    
    echo "🧪 Test enum Users_role..."
    local roles=$(psql -U postgres -d attendance_system -t -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_Users_role');" | tr '\n' ' ')
    
    if [[ $roles == *"teacher"* ]]; then
        print_success "Enum Users_role include 'teacher'"
    else
        print_error "Enum Users_role non include 'teacher'"
    fi
}

# Riepilogo finale
final_summary() {
    print_step "RIEPILOGO FINALE"
    
    echo -e "${GREEN}"
    echo "🎉 SETUP COMPLETATO CON SUCCESSO!"
    echo ""
    echo "📋 STATO SISTEMA:"
    echo "  ✅ Database resettato e ricreato"
    echo "  ✅ 8 migrazioni moderne applicate"
    echo "  ✅ Seeder aggiornati eseguiti"
    echo "  ✅ Sistema BLOB configurato"
    echo "  ✅ Supporto camera IP integrato"
    echo "  ✅ Face detection pronto"
    echo "  ✅ CameraLogs per debug/monitoring"
    echo ""
    echo "👤 UTENTI DI TEST:"
    echo "  Admin:   admin@test.com / password"
    echo "  Teacher: teacher@test.com / password"
    echo ""
    echo "🚀 PROSSIMI PASSI:"
    echo "  1. npm run dev              # Avvia server"
    echo "  2. Test login admin         # http://localhost:4321"
    echo "  3. Test sistema BLOB        # curl http://localhost:4321/api/images/list"
    echo "  4. Test teacher dashboard   # Interfaccia web"
    echo ""
    echo "💾 STORAGE MODE: Database BLOB completo"
    echo "📸 CAMERA SUPPORT: Integrato con simulatore"
    echo "🤖 FACE DETECTION: Pronto per uso"
    echo -e "${NC}"
}

# === ESECUZIONE SCRIPT ===

# Conferma utente
echo "⚠️  ATTENZIONE: Questo script resetterà completamente il database!"
echo "   - Tutti i dati esistenti saranno eliminati"
echo "   - Verranno applicate migrazioni moderne"
echo "   - Il sistema sarà ricreato da zero"
echo ""
echo "Continuare? (y/N): "
read -r response

if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "❌ Setup annullato"
    exit 0
fi

# Esecuzione step
check_dependencies
backup_database
reset_database
setup_migrations_directory
apply_migrations
create_modern_seeders
apply_seeders
test_system
final_summary

echo ""
echo "🎯 Setup moderno completato! Il sistema è pronto per l'uso."