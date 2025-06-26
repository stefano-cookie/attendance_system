#!/bin/bash

# Script per risolvere i problemi di compatibilità Python/DeepFace
# Salva come: fix_python_env.sh

echo "🔧 RISOLUZIONE PROBLEMI DEEPFACE/TENSORFLOW"
echo "============================================"

# Verifica Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 non trovato. Installa Python3 prima di continuare."
    exit 1
fi

echo "✅ Python trovato: $(python3 --version)"

# Vai nella directory del progetto
cd "$(dirname "$0")"
PROJECT_ROOT="$(pwd)"

echo "📁 Directory progetto: $PROJECT_ROOT"

# Opzione 1: Usa venv_deepface esistente se funziona
if [ -d "venv_deepface" ]; then
    echo "🔍 Trovato venv_deepface esistente, test in corso..."
    
    source venv_deepface/bin/activate
    
    # Test DeepFace
    if python3 -c "from deepface import DeepFace; print('DeepFace OK')" 2>/dev/null; then
        echo "✅ venv_deepface funziona correttamente!"
        echo "💡 Usa questo comando per attivarlo: source venv_deepface/bin/activate"
        
        # Test completo
        echo "🧪 Test completo..."
        if [ -f "backend/scripts/face_detection.py" ]; then
            python3 backend/scripts/face_detection.py --help >/dev/null 2>&1
            if [ $? -eq 0 ]; then
                echo "✅ Script face_detection.py funziona!"
                echo "🎉 SOLUZIONE: Usa venv_deepface"
                exit 0
            fi
        fi
    else
        echo "❌ venv_deepface non funziona"
    fi
    
    deactivate
fi

# Opzione 2: Crea nuovo venv con versioni compatibili
echo "🔄 Creazione nuovo ambiente virtuale..."

# Rimuovi venv esistente se presente
if [ -d "venv" ]; then
    echo "🗑️  Rimozione venv esistente..."
    rm -rf venv
fi

# Crea nuovo venv
python3 -m venv venv
source venv/bin/activate

echo "📦 Installazione librerie compatibili..."

# Aggiorna pip
pip install --upgrade pip

# Installa versioni specifiche compatibili
pip install tensorflow==2.13.0
pip install deepface==0.0.79  
pip install retinaface==0.0.17
pip install opencv-python==4.8.1.78
pip install numpy==1.24.3
pip install Pillow==10.0.1

# Librerie aggiuntive per lo script
pip install argparse traceback

echo "🧪 Test installazione..."

# Test import
python3 -c "
import tensorflow as tf
print(f'✅ TensorFlow {tf.__version__}')

from deepface import DeepFace
print('✅ DeepFace OK')

import retinaface
print('✅ RetinaFace OK')

import cv2
print(f'✅ OpenCV {cv2.__version__}')

import numpy as np
print(f'✅ NumPy {np.__version__}')

from PIL import Image
print('✅ Pillow OK')
"

if [ $? -eq 0 ]; then
    echo "✅ Tutte le librerie installate correttamente!"
    
    # Test script face_detection
    if [ -f "backend/scripts/face_detection.py" ]; then
        echo "🧪 Test script face_detection.py..."
        python3 backend/scripts/face_detection.py --help >/dev/null 2>&1
        if [ $? -eq 0 ]; then
            echo "✅ Script face_detection.py funziona!"
        else
            echo "⚠️  Script face_detection.py ha problemi, ma le librerie sono OK"
        fi
    fi
    
    echo ""
    echo "🎉 INSTALLAZIONE COMPLETATA!"
    echo "💡 Per usare l'ambiente: source venv/bin/activate"
    echo "🧪 Per testare: node backend/debug_face_detection.js 1"
    
else
    echo "❌ Errori durante l'installazione"
    exit 1
fi