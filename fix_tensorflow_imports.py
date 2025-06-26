"""
Fix per problemi di import TensorFlow/Keras
"""

import sys
import subprocess
import os

print("🔧 FIX TENSORFLOW/KERAS IMPORTS")
print("=" * 40)

# 1. Verifica Python path
print(f"\n1️⃣ Python executable: {sys.executable}")
print(f"   Python version: {sys.version}")

# 2. Verifica TensorFlow
print("\n2️⃣ Verifico TensorFlow...")
try:
    import tensorflow as tf
    print(f"   ✅ TensorFlow {tf.__version__} importato")
    
    # Verifica keras
    try:
        from tensorflow import keras
        print("   ✅ tensorflow.keras disponibile")
    except:
        print("   ❌ tensorflow.keras NON disponibile")
        
        # Prova fix
        print("\n3️⃣ Applico fix...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "tensorflow-macos==2.13.0"])
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "keras==2.13.1"])
        
except ImportError:
    print("   ❌ TensorFlow non installato")
    print("\n3️⃣ Installo TensorFlow...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "tensorflow-macos==2.13.0"])

# 3. Verifica DeepFace
print("\n4️⃣ Verifico DeepFace...")
try:
    # Prima reinstalla per essere sicuri
    subprocess.check_call([sys.executable, "-m", "pip", "uninstall", "-y", "deepface"])
    subprocess.check_call([sys.executable, "-m", "pip", "install", "deepface==0.0.79"])
    
    from deepface import DeepFace
    print("   ✅ DeepFace installato e importato")
    
    # Test veloce
    import numpy as np
    test_img = np.zeros((100, 100, 3), dtype=np.uint8)
    result = DeepFace.represent(
        img_path=test_img,
        model_name="VGG-Face",
        enforce_detection=False,
        detector_backend="skip"
    )
    print(f"   ✅ Test DeepFace OK: embedding size = {len(result[0]['embedding'])}")
    
except Exception as e:
    print(f"   ❌ Errore DeepFace: {e}")

# 4. Crea script wrapper
print("\n5️⃣ Creo script wrapper...")

wrapper_content = f"""#!/usr/bin/env python3
import sys
import os

# Forza l'uso del Python del venv
VENV_PYTHON = "{sys.executable}"

if __name__ == "__main__":
    import subprocess
    args = [VENV_PYTHON] + sys.argv[1:]
    subprocess.call(args)
"""

wrapper_path = os.path.join(os.path.dirname(sys.executable), "python3-deepface")
with open(wrapper_path, "w") as f:
    f.write(wrapper_content)

os.chmod(wrapper_path, 0o755)

print(f"\n✅ Script wrapper creato: {wrapper_path}")
print("\n📝 Prossimi passi:")
print("1. Modifica face_detection.py e aggiungi all'inizio:")
print("   import sys")
print(f"   sys.path.insert(0, '{os.path.dirname(sys.executable)}/../lib/python3.10/site-packages')")
print("\n2. Oppure usa sempre il path completo:")
print(f"   {sys.executable} scripts/face_detection.py")

print("\n✅ FIX COMPLETATO!")