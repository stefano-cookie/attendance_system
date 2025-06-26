import cv2
import numpy as np
import os
import sys
import argparse
from deepface import DeepFace
from retinaface import RetinaFace

# Crea directory di output
output_dir = "debug_output"
os.makedirs(output_dir, exist_ok=True)

# Gestisci parametri
parser = argparse.ArgumentParser(description='Test riconoscimento facciale')
parser.add_argument('image_path', help='Percorso dell\'immagine')
parser.add_argument('--students', help='File JSON studenti')
args = parser.parse_args()

print(f"Analisi immagine: {args.image_path}")
print(f"File studenti: {args.students}")

# Verifica immagine
if not os.path.exists(args.image_path):
    print(f"ERRORE: Immagine non trovata: {args.image_path}")
    sys.exit(1)

# Carica immagine
img = cv2.imread(args.image_path)
if img is None:
    print(f"ERRORE: Impossibile leggere immagine: {args.image_path}")
    sys.exit(1)

print(f"Immagine caricata: {img.shape[1]}x{img.shape[0]} pixel")

# Rileva volti con RetinaFace
print("Rilevamento volti...")
img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
faces = RetinaFace.detect_faces(img_rgb)

if not faces:
    print("NESSUN VOLTO RILEVATO nell'immagine!")
    sys.exit(1)

print(f"SUCCESSO! Rilevati {len(faces)} volti")

# Disegna rettangoli
result_img = img.copy()
for i, (face_idx, face_data) in enumerate(faces.items()):
    x1, y1, x2, y2 = face_data["facial_area"]
    confidence = face_data.get("score", 0)
    print(f"Volto {i+1}: posizione ({x1},{y1})-({x2},{y2}), confidenza: {confidence:.2f}")
    
    # Disegna rettangolo
    cv2.rectangle(result_img, (x1, y1), (x2, y2), (0, 255, 0), 2)
    
    # Aggiungi numero
    cv2.putText(result_img, f"Volto {i+1}", (x1, y1-10), 
               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

# Salva risultato
result_path = os.path.join(output_dir, "volti_rilevati.jpg")
cv2.imwrite(result_path, result_img)
print(f"Immagine con volti salvata in: {os.path.abspath(result_path)}")

print("Test completato con successo!")
