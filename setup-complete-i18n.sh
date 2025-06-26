#!/bin/bash
# setup-complete-i18n.sh - Script master per setup completo sistema multilingua

set -e  # Exit on any error

echo "🌍 SETUP COMPLETO SISTEMA MULTILINGUA"
echo "======================================"
echo ""

# Colori per output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funzioni utility
log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Verifica prerequisiti
check_prerequisites() {
    log_info "Verifica prerequisiti..."
    
    if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
        log_error "Esegui questo script dalla root del progetto!"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js non trovato!"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm non trovato!"
        exit 1
    fi
    
    log_success "Prerequisiti verificati"
}

# Step 1: Crea gli script necessari
create_scripts() {
    log_info "Creazione script di automazione..."
    
    # Qui dovresti copiare il contenuto degli artifacts nei file
    log_warning "⚠️  AZIONE RICHIESTA:"
    echo "   1. Copia il contenuto dell'artifact 'text_scanner_script' in 'scan-hardcoded-texts.js'"
    echo "   2. Copia il contenuto dell'artifact 'complete_translation_system' in 'complete-translation-system.js'"
    echo "   3. Copia il contenuto dell'artifact 'migration_automation' in 'migrate-components.js'"
    echo "   4. Copia il contenuto dell'artifact 'verification_script' in 'verify-translation-system.js'"
    echo ""
    read -p "Premi ENTER quando hai completato questi passi..."
    
    # Rendi eseguibili
    chmod +x scan-hardcoded-texts.js 2>/dev/null || true
    chmod +x complete-translation-system.js 2>/dev/null || true
    chmod +x migrate-components.js 2>/dev/null || true
    chmod +x verify-translation-system.js 2>/dev/null || true
    
    log_success "Script creati"
}

# Step 2: Installa dipendenze (se non già fatto)
install_dependencies() {
    log_info "Verifica dipendenze frontend..."
    
    cd frontend
    
    if ! npm list react-i18next &> /dev/null; then
        log_info "Installazione dipendenze i18n..."
        npm install react-i18next@13.5.0 i18next@23.7.16 i18next-browser-languagedetector@7.2.0 i18next-http-backend@2.4.2
        log_success "Dipendenze installate"
    else
        log_success "Dipendenze già presenti"
    fi
    
    cd ..
}

# Step 3: Scansiona testi esistenti
scan_existing_texts() {
    log_info "Scansione testi hard-coded esistenti..."
    
    if [ -f "scan-hardcoded-texts.js" ]; then
        node scan-hardcoded-texts.js > scan-output.log 2>&1
        
        if [ -f "translation-scan-report.json" ]; then
            log_success "Scansione completata - Report: translation-scan-report.json"
            
            # Mostra statistiche veloci
            if command -v jq &> /dev/null; then
                TOTAL_TEXTS=$(jq '.meta.totalTexts' translation-scan-report.json 2>/dev/null || echo "N/A")
                log_info "Testi trovati: $TOTAL_TEXTS"
            fi
        else
            log_warning "Report di scansione non generato"
        fi
    else
        log_error "Script scan-hardcoded-texts.js non trovato!"
        return 1
    fi
}

# Step 4: Crea sistema completo di traduzione
create_translation_system() {
    log_info "Creazione sistema completo di traduzione..."
    
    if [ -f "complete-translation-system.js" ]; then
        node complete-translation-system.js > translation-setup.log 2>&1
        
        # Verifica creazione file
        TRANSLATION_FILES=$(find frontend/src/locales -name "*.json" 2>/dev/null | wc -l)
        if [ "$TRANSLATION_FILES" -gt 0 ]; then
            log_success "Sistema traduzione creato - $TRANSLATION_FILES file generati"
        else
            log_warning "File traduzione non trovati"
        fi
    else
        log_error "Script complete-translation-system.js non trovato!"
        return 1
    fi
}

# Step 5: Migra componenti automaticamente
migrate_components() {
    log_info "Migrazione automatica componenti..."
    
    if [ -f "migrate-components.js" ]; then
        node migrate-components.js > migration.log 2>&1
        
        if [ -f "migration-report.md" ]; then
            log_success "Migrazione completata - Report: migration-report.md"
        else
            log_warning "Report migrazione non generato"
        fi
        
        # Conta TODO rimanenti
        TODO_COUNT=$(grep -r "TODO: Traduci" frontend/src/ 2>/dev/null | wc -l || echo "0")
        log_info "TODO rimanenti: $TODO_COUNT"
    else
        log_error "Script migrate-components.js non trovato!"
        return 1
    fi
}

# Step 6: Verifica sistema
verify_system() {
    log_info "Verifica sistema multilingua..."
    
    if [ -f "verify-translation-system.js" ]; then
        node verify-translation-system.js > verification.log 2>&1
        
        if [ -f "translation-verification-report.json" ]; then
            log_success "Verifica completata"
            
            # Mostra punteggio se jq disponibile
            if command -v jq &> /dev/null; then
                SCORE=$(jq '.score' translation-verification-report.json 2>/dev/null || echo "N/A")
                log_info "Punteggio sistema: $SCORE%"
            fi
        else
            log_warning "Report verifica non generato"
        fi
    else
        log_error "Script verify-translation-system.js non trovato!"
        return 1
    fi
}

# Step 7: Test build
test_build() {
    log_info "Test build frontend..."
    
    cd frontend
    
    if npm run build > ../build.log 2>&1; then
        log_success "Build frontend completata"
    else
        log_error "Build frontend fallita - Controlla build.log"
        cd ..
        return 1
    fi
    
    cd ..
}

# Step 8: Genera riassunto
generate_summary() {
    log_info "Generazione riassunto..."
    
    cat > setup-summary.md << EOF
# 🌍 Riassunto Setup Sistema Multilingua

## ✅ Completato
- Sistema multilingua base installato
- File di traduzione generati (IT/EN/RO)
- Componenti migrati automaticamente
- Sistema verificato

## 📊 Statistiche
EOF

    if [ -f "translation-scan-report.json" ] && command -v jq &> /dev/null; then
        TOTAL_TEXTS=$(jq '.meta.totalTexts' translation-scan-report.json 2>/dev/null || echo "N/A")
        echo "- Testi identificati: $TOTAL_TEXTS" >> setup-summary.md
    fi

    if [ -f "translation-verification-report.json" ] && command -v jq &> /dev/null; then
        SCORE=$(jq '.score' translation-verification-report.json 2>/dev/null || echo "N/A")
        echo "- Punteggio sistema: $SCORE%" >> setup-summary.md
    fi

    TODO_COUNT=$(grep -r "TODO: Traduci" frontend/src/ 2>/dev/null | wc -l || echo "0")
    echo "- TODO rimanenti: $TODO_COUNT" >> setup-summary.md

    cat >> setup-summary.md << EOF

## 🔄 Prossimi Passi
1. Risolvi i TODO rimanenti (\`grep -r "TODO: Traduci" frontend/src/\`)
2. Testa il sistema in tutte le lingue
3. Aggiungi traduzioni mancanti nei file JSON
4. Migra le route backend rimanenti

## 📁 File Generati
- \`translation-scan-report.json\` - Report scansione testi
- \`migration-report.md\` - Report migrazione componenti  
- \`translation-verification-report.json\` - Report verifica sistema
- \`setup-summary.md\` - Questo riassunto

## 🧪 Test Sistema
\`\`\`bash
# Avvia frontend
cd frontend && npm start

# Testa cambio lingua
# Verifica persistenza
# Controlla tutti i componenti
\`\`\`
EOF

    log_success "Riassunto generato: setup-summary.md"
}

# Main execution
main() {
    check_prerequisites
    create_scripts
    install_dependencies
    scan_existing_texts
    create_translation_system
    migrate_components
    verify_system
    test_build
    generate_summary
    
    echo ""
    echo "🎉 SETUP COMPLETATO!"
    echo "===================="
    echo ""
    log_success "Sistema multilingua installato e configurato"
    log_info "Controlla setup-summary.md per i dettagli"
    log_info "Esegui i test manualmente e risolvi i TODO rimanenti"
    echo ""
    echo "📋 Quick Start:"
    echo "   cd frontend && npm start"
    echo "   Testa il selettore lingua nel login"
    echo ""
}

# Gestione errori
trap 'log_error "Setup fallito! Controlla i log per dettagli."; exit 1' ERR

# Esecuzione con conferma
echo "Questo script configurerà il sistema multilingua completo."
echo "Tempo stimato: 5-10 minuti"
echo ""
read -p "Continuare? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    main
else
    echo "Setup annullato."
    exit 0
fi