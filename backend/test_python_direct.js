// backend/test_python_direct.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧪 TEST DIRETTO SCRIPT PYTHON');
console.log('===========================\n');

// Percorsi
const pythonExecutable = '/Users/stebbi/attendance-system/venv_deepface/bin/python3';
const scriptPath = path.join(__dirname, 'scripts', 'face_detection.py');

// Verifica esistenza file
console.log(`📁 Script Python: ${scriptPath}`);
console.log(`   Esiste: ${fs.existsSync(scriptPath) ? '✅' : '❌'}`);
console.log(`🐍 Python executable: ${pythonExecutable}`);
console.log(`   Esiste: ${fs.existsSync(pythonExecutable) ? '✅' : '❌'}\n`);

// Test 1: Verifica Python
console.log('📋 TEST 1: Verifica Python');
const pythonVersion = spawn(pythonExecutable, ['--version']);
pythonVersion.stdout.on('data', (data) => console.log(`   ✅ ${data.toString().trim()}`));
pythonVersion.stderr.on('data', (data) => console.log(`   ✅ ${data.toString().trim()}`));

// Test 2: Import DeepFace
setTimeout(() => {
    console.log('\n📋 TEST 2: Import DeepFace');
    const testImport = spawn(pythonExecutable, ['-c', 'from deepface import DeepFace; print("DeepFace importato correttamente!")']);
    
    testImport.stdout.on('data', (data) => console.log(`   ✅ ${data.toString().trim()}`));
    testImport.stderr.on('data', (data) => console.error(`   ❌ ${data.toString().trim()}`));
    
    testImport.on('close', (code) => {
        if (code === 0) {
            console.log('   ✅ DeepFace importato correttamente\n');
            runMainTest();
        } else {
            console.log('   ❌ Errore import DeepFace - Verificare installazione');
        }
    });
}, 1000);

// Test 3: Script completo con timeout
function runMainTest() {
    console.log('📋 TEST 3: Esecuzione script face_detection.py');
    console.log('   ⏱️  Timeout: 30 secondi\n');
    
    // Usa un'immagine di test se esiste
    const testImagePath = path.join(__dirname, 'temp', 'test_image.jpg');
    const tempImagePath = path.join(__dirname, 'temp', 'face_processing', 'images', 'test_direct.jpg');
    
    // Crea immagine di test se non esiste
    if (!fs.existsSync(testImagePath)) {
        console.log('   ⚠️  Nessuna immagine di test trovata');
        console.log('   📸 Creando immagine vuota di test...');
        
        // Crea directory se non esiste
        const tempDir = path.dirname(tempImagePath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Crea immagine vuota (1x1 pixel nero)
        const blackPixel = Buffer.from([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
            0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
            0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
            0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
            0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
            0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0x35, 0x10, 0x00, 0x02, 0x01, 0x02,
            0x04, 0x04, 0x03, 0x04, 0x07, 0x05, 0x04, 0x04, 0x00, 0x01, 0x02, 0x77,
            0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41,
            0x51, 0x07, 0x61, 0x71, 0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91,
            0xA1, 0xB1, 0xC1, 0x09, 0x23, 0x33, 0x52, 0xF0, 0x15, 0x62, 0x72, 0xD1,
            0x0A, 0x16, 0x24, 0x34, 0xE1, 0x25, 0xF1, 0x17, 0x18, 0x19, 0x1A, 0x26,
            0x27, 0x28, 0x29, 0x2A, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44,
            0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58,
            0x59, 0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74,
            0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
            0x88, 0x89, 0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A,
            0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4,
            0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7,
            0xC8, 0xC9, 0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA,
            0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF2, 0xF3, 0xF4,
            0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
            0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD2, 0x8A, 0x28, 0xAF, 0xFF, 0xD9
        ]);
        fs.writeFileSync(tempImagePath, blackPixel);
        console.log(`   ✅ Immagine di test creata: ${tempImagePath}\n`);
    } else {
        // Copia immagine esistente
        fs.copyFileSync(testImagePath, tempImagePath);
        console.log(`   ✅ Usando immagine: ${testImagePath}\n`);
    }
    
    const outputPath = path.join(__dirname, 'temp', 'test_output.json');
    
    const args = [
        scriptPath,
        tempImagePath,
        '--output', outputPath,
        '--debug'
    ];
    
    console.log(`   🐍 Comando: ${pythonExecutable} ${args.join(' ')}\n`);
    
    const startTime = Date.now();
    const pythonProcess = spawn(pythonExecutable, args, {
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });
    
    // Timeout di 30 secondi
    const timeout = setTimeout(() => {
        console.log('\n   ⏱️  TIMEOUT! Killing process...');
        pythonProcess.kill('SIGKILL');
    }, 30000);
    
    let outputBuffer = '';
    let errorBuffer = '';
    
    pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        outputBuffer += output;
        console.log(`   📤 STDOUT: ${output.trim()}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
        const error = data.toString();
        errorBuffer += error;
        console.error(`   📥 STDERR: ${error.trim()}`);
    });
    
    pythonProcess.on('error', (error) => {
        clearTimeout(timeout);
        console.error(`\n   ❌ ERRORE SPAWN: ${error.message}`);
    });
    
    pythonProcess.on('close', (code) => {
        clearTimeout(timeout);
        const elapsed = Date.now() - startTime;
        
        console.log(`\n   ⏱️  Tempo esecuzione: ${elapsed}ms`);
        console.log(`   🏁 Exit code: ${code}`);
        
        if (code === 0) {
            console.log('   ✅ Script completato con successo!');
            
            // Verifica output
            if (fs.existsSync(outputPath)) {
                try {
                    const result = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
                    console.log('\n   📊 RISULTATO:');
                    console.log(`      - Volti rilevati: ${result.detected_faces || 0}`);
                    console.log(`      - Studenti riconosciuti: ${result.recognized_students?.length || 0}`);
                    console.log(`      - Errori: ${result.error || 'Nessuno'}`);
                } catch (e) {
                    console.log('   ⚠️  Errore parsing output JSON');
                }
            }
        } else {
            console.log('   ❌ Script fallito!');
            console.log('\n   📜 ULTIMI 500 CARATTERI OUTPUT:');
            console.log(outputBuffer.slice(-500));
            console.log('\n   📜 ULTIMI 500 CARATTERI ERRORI:');
            console.log(errorBuffer.slice(-500));
        }
        
        // Cleanup
        setTimeout(() => {
            if (fs.existsSync(tempImagePath)) fs.unlinkSync(tempImagePath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }, 1000);
    });
}