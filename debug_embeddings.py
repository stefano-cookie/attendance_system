#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import cv2
import numpy as np
import json
from deepface import DeepFace
from retinaface import RetinaFace
import matplotlib.pyplot as plt

def debug_face_recognition():
    """Debug approfondito del sistema di riconoscimento facciale"""
    
    # Percorsi
    project_root = "/Users/stebbi/attendance-system"
    data_dir = os.path.join(project_root, "data")
    
    # File da analizzare
    group_image = os.path.join(data_dir, "classroom_images", "Informatica", "Fondamenti_di_Javascript", "gruppo.jpg")
    stefano_photo = os.path.join(data_dir, "user_photos", "PRLSFN00C03H224A.jpg")
    alice_photo = os.path.join(data_dir, "user_photos", "ALCOL96FJEFNE.jpg")
    
    print("🔍 DEBUG APPROFONDITO SISTEMA RICONOSCIMENTO")
    print("=" * 50)
    
    # 1. Verifica esistenza file
    print(f"📁 Group image: {os.path.exists(group_image)} - {group_image}")
    print(f"📁 Stefano photo: {os.path.exists(stefano_photo)} - {stefano_photo}")
    print(f"📁 Alice photo: {os.path.exists(alice_photo)} - {alice_photo}")
    
    if not all([os.path.exists(f) for f in [group_image, stefano_photo, alice_photo]]):
        print("❌ Alcuni file non esistono!")
        return
    
    # 2. Carica e mostra dimensioni immagini
    group_img = cv2.imread(group_image)
    stefano_img = cv2.imread(stefano_photo)
    alice_img = cv2.imread(alice_photo)
    
    print(f"\n📏 Dimensioni immagini:")
    print(f"  Group: {group_img.shape}")
    print(f"  Stefano: {stefano_img.shape}")
    print(f"  Alice: {alice_img.shape}")
    
    # 3. Rileva volti nell'immagine di gruppo
    print(f"\n🔍 Rilevamento volti nell'immagine di gruppo...")
    
    try:
        group_rgb = cv2.cvtColor(group_img, cv2.COLOR_BGR2RGB)
        faces = RetinaFace.detect_faces(group_rgb)
        
        print(f"✅ Rilevati {len(faces)} volti")
        
        # Estrai i volti
        face_images = []
        for face_idx, face_data in faces.items():
            facial_area = face_data["facial_area"]
            x1, y1, x2, y2 = facial_area
            
            face_img = group_img[y1:y2, x1:x2].copy()
            face_images.append({
                'idx': face_idx,
                'image': face_img,
                'area': facial_area,
                'confidence': face_data.get('score', 0)
            })
            
            print(f"  Volto {face_idx}: area={facial_area}, confidence={face_data.get('score', 0):.3f}")
            
            # Salva il volto per debug visivo
            debug_face_path = os.path.join(data_dir, f"debug_volto_{face_idx}.jpg")
            cv2.imwrite(debug_face_path, face_img)
            print(f"    💾 Salvato in: {debug_face_path}")
        
    except Exception as e:
        print(f"❌ Errore rilevamento volti: {e}")
        return
    
    # 4. Estrai embedding dalle foto di riferimento
    print(f"\n🧠 Estrazione embedding foto di riferimento...")
    
    def extract_embedding(img_path, name):
        try:
            result = DeepFace.represent(
                img_path=img_path,
                model_name="ArcFace",
                enforce_detection=True,
                detector_backend="retinaface",
                align=True,
                normalization="base"
            )
            
            if isinstance(result, list) and len(result) > 0:
                if isinstance(result[0], dict) and 'embedding' in result[0]:
                    embedding = np.array(result[0]['embedding'])
                else:
                    embedding = np.array(result[0])
            else:
                embedding = np.array(result)
            
            print(f"  ✅ {name}: shape={embedding.shape}, tipo={type(embedding)}")
            return embedding
            
        except Exception as e:
            print(f"  ❌ {name}: Errore - {e}")
            return None
    
    stefano_embedding = extract_embedding(stefano_photo, "Stefano")
    alice_embedding = extract_embedding(alice_photo, "Alice")
    
    # 5. Estrai embedding dai volti rilevati
    print(f"\n🧠 Estrazione embedding volti rilevati...")
    
    face_embeddings = []
    for face_data in face_images:
        face_idx = face_data['idx']
        face_img = face_data['image']
        
        try:
            result = DeepFace.represent(
                img_path=face_img,
                model_name="ArcFace",
                enforce_detection=False,
                detector_backend="skip",
                align=True,
                normalization="base"
            )
            
            if isinstance(result, list) and len(result) > 0:
                if isinstance(result[0], dict) and 'embedding' in result[0]:
                    embedding = np.array(result[0]['embedding'])
                else:
                    embedding = np.array(result[0])
            else:
                embedding = np.array(result)
            
            face_embeddings.append({
                'idx': face_idx,
                'embedding': embedding
            })
            
            print(f"  ✅ Volto {face_idx}: shape={embedding.shape}")
            
        except Exception as e:
            print(f"  ❌ Volto {face_idx}: Errore - {e}")
    
    # 6. Calcola tutte le similarità
    print(f"\n📊 MATRICE DELLE SIMILARITÀ:")
    print("=" * 40)
    
    from deepface.commons import distance as dst
    
    for face_emb in face_embeddings:
        face_idx = face_emb['idx']
        face_embedding = face_emb['embedding']
        
        print(f"\n🎭 VOLTO {face_idx}:")
        
        if stefano_embedding is not None:
            try:
                distance = dst.findCosineDistance(face_embedding, stefano_embedding)
                similarity = 1.0 - distance
                print(f"  vs Stefano: {similarity:.4f} ({distance:.4f} distanza)")
            except Exception as e:
                print(f"  vs Stefano: ERRORE - {e}")
        
        if alice_embedding is not None:
            try:
                distance = dst.findCosineDistance(face_embedding, alice_embedding)
                similarity = 1.0 - distance
                print(f"  vs Alice:   {similarity:.4f} ({distance:.4f} distanza)")
            except Exception as e:
                print(f"  vs Alice: ERRORE - {e}")
    
    # 7. Raccomandazioni
    print(f"\n💡 RACCOMANDAZIONI:")
    print("=" * 30)
    print("1. Controlla i volti estratti salvati in debug_volto_*.jpg")
    print("2. Verifica quale volto somiglia di più a Stefano visivamente")
    print("3. Se la similarità è bassa per tutti, il problema potrebbe essere:")
    print("   - Qualità delle foto di riferimento")
    print("   - Angolazione/illuminazione diversa")
    print("   - Modello di embedding non adatto")
    print("4. Considera di usare soglie più basse o modelli diversi")
    
    # 8. Salva risultati dettagliati
    debug_results = {
        'faces_detected': len(faces),
        'face_areas': [f['area'] for f in face_images],
        'stefano_embedding_loaded': stefano_embedding is not None,
        'alice_embedding_loaded': alice_embedding is not None,
        'face_embeddings_extracted': len(face_embeddings)
    }
    
    debug_file = os.path.join(data_dir, "debug_results.json")
    with open(debug_file, 'w') as f:
        json.dump(debug_results, f, indent=2, default=str)
    
    print(f"\n💾 Risultati debug salvati in: {debug_file}")

if __name__ == "__main__":
    debug_face_recognition()