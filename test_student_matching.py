import cv2
import os
import json
import argparse
import tempfile
from datetime import datetime
from deepface import DeepFace
from retinaface import RetinaFace
import shutil

def test_student_matching(image_path, students_json_path):
    print(f"===== TEST MATCHING STUDENTI =====")
    print(f"Immagine: {image_path}")
    print(f"JSON studenti: {students_json_path}")
    
    # Crea directory temporanea per i volti estratti
    temp_dir = tempfile.mkdtemp()
    debug_dir = os.path.join(temp_dir, "debug")
    os.makedirs(debug_dir, exist_ok=True)
    
    # Directory del progetto
    data_dir = os.path.dirname(os.path.abspath(students_json_path))
    reports_dir = os.path.join(data_dir, "reports")
    
    # Timestamp per i nomi file
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # Carica immagine
    img = cv2.imread(image_path)
    if img is None:
        print(f"❌ ERRORE: Impossibile leggere l'immagine: {image_path}")
        return False
    
    # Carica studenti
    try:
        with open(students_json_path, 'r', encoding='utf-8') as f:
            students_data = json.load(f)
            
        # Gestisci vari formati di JSON
        if isinstance(students_data, dict):
            if 'students' in students_data:
                students = students_data['students']
            elif 'data' in students_data:
                students = students_data['data']
            else:
                students = students_data
        else:
            students = students_data
            
        print(f"✅ Caricati {len(students)} studenti dal file JSON")
    except Exception as e:
        print(f"❌ ERRORE nel caricamento dati studenti: {str(e)}")
        return False
    
    # Rileva volti nell'immagine
    print("\n===== RILEVAMENTO VOLTI NELL'IMMAGINE =====")
    faces = RetinaFace.detect_faces(img)
    
    if not faces:
        print("❌ ERRORE: Nessun volto rilevato nell'immagine")
        return False
        
    print(f"✅ Rilevati {len(faces)} volti nell'immagine")
    
    # Prepara l'immagine per il report
    report_img = img.copy()
    
    # Estrai e salva tutti i volti
    face_files = []
    face_coords = []
    
    for face_idx, face_data in faces.items():
        facial_area = face_data["facial_area"]
        x1, y1, x2, y2 = facial_area
        
        # Estrai volto con margine extra (per migliore riconoscimento)
        margin = int((x2 - x1) * 0.2)  # 20% di margine
        x1_m = max(0, x1 - margin)
        y1_m = max(0, y1 - margin)
        x2_m = min(img.shape[1], x2 + margin)
        y2_m = min(img.shape[0], y2 + margin)
        
        face_img = img[y1_m:y2_m, x1_m:x2_m]
        
        # Salva volto come file temporaneo
        face_file = os.path.join(temp_dir, f"face_{face_idx}.jpg")
        cv2.imwrite(face_file, face_img)
        
        # Salva anche in directory debug per ispezione
        debug_face = os.path.join(debug_dir, f"face_{face_idx}.jpg")
        cv2.imwrite(debug_face, face_img)
        
        face_files.append(face_file)
        face_coords.append((x1, y1, x2, y2))
    
    # Estrai e salva foto studenti per debug
    student_files = []
    for student in students:
        name = f"{student.get('name', '')} {student.get('surname', '')}"
        photo_path = student.get('photoPath', '')
        
        if photo_path and os.path.exists(photo_path):
            # Salva copia per debug
            debug_student = os.path.join(debug_dir, f"{name.replace(' ', '_')}.jpg")
            shutil.copy(photo_path, debug_student)
            
            student_files.append({
                'id': student.get('id'),
                'name': name,
                'path': photo_path
            })
    
    # Usa DeepFace.find per confrontare ogni volto con tutti gli studenti
    print("\n===== MATCHING VOLTI CON STUDENTI =====")
    
    # Modelli da provare in ordine di precisione/tolleranza
    models = ["VGG-Face", "Facenet512", "Facenet", "ArcFace"]
    
    # Memorizza i risultati per ogni volto
    face_results = []
    
    # Per ogni volto nell'immagine
    for i, face_file in enumerate(face_files):
        print(f"\nAnalisi volto {i+1}/{len(face_files)}")
        
        face_result = {
            'face_idx': i,
            'coords': face_coords[i],
            'matches': []
        }
        
        # Prova ogni modello
        for model_name in models:
            print(f"  Provo modello: {model_name}")
            
            for student in student_files:
                try:
                    # Confronta direttamente usando DeepFace.verify
                    result = DeepFace.verify(
                        img1_path=face_file,
                        img2_path=student['path'],
                        model_name=model_name,
                        distance_metric="cosine",
                        enforce_detection=False
                    )
                    
                    # Estrai risultati
                    distance = result.get('distance', 1.0)
                    similarity = 1.0 - distance
                    
                    # Definisci soglie specifiche per ogni modello
                    thresholds = {
                        "VGG-Face": 0.4,
                        "Facenet": 0.4,
                        "Facenet512": 0.3,
                        "ArcFace": 0.25
                    }
                    threshold = thresholds.get(model_name, 0.4)
                    
                    # Determina match
                    match = similarity >= threshold
                    match_symbol = "✓" if match else "✗"
                    
                    print(f"    {student['name']}: {similarity:.4f} con {model_name} {match_symbol}")
                    
                    # Aggiungi ai risultati
                    face_result['matches'].append({
                        'student_id': student['id'],
                        'name': student['name'],
                        'model': model_name,
                        'similarity': similarity,
                        'threshold': threshold,
                        'match': match
                    })
                    
                except Exception as e:
                    print(f"    ⚠️ Errore confronto con {student['name']}: {str(e)}")
        
        # Aggiungi ai risultati complessivi
        face_results.append(face_result)
    
    # Per ogni volto, trova il miglior match
    print("\n===== RISULTATI FINALI =====")
    
    for face_result in face_results:
        face_idx = face_result['face_idx']
        x1, y1, x2, y2 = face_result['coords']
        
        # Trova il miglior match (priorità a match positivi, poi al punteggio più alto)
        positive_matches = [m for m in face_result['matches'] if m['match']]
        
        if positive_matches:
            # Ordina per similarità
            best_match = sorted(positive_matches, key=lambda m: m['similarity'], reverse=True)[0]
            
            # Informazioni sul match
            student_name = best_match['name']
            model = best_match['model']
            similarity = best_match['similarity']
            
            print(f"✅ Volto {face_idx+1}: {student_name} ({similarity:.4f} con {model})")
            
            # Disegna rettangolo verde
            cv2.rectangle(report_img, (x1, y1), (x2, y2), (0, 255, 0), 2)
            
            # Aggiungi etichetta
            text = f"{student_name} ({similarity:.2f})"
            text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
            cv2.rectangle(report_img, 
                        (x1, y1 - text_size[1] - 10), 
                        (x1 + text_size[0], y1), 
                        (0, 0, 0), 
                        -1)
            cv2.putText(report_img, text, (x1, y1 - 10), 
                      cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        else:
            # Nessun match positivo, trova il miglior punteggio
            all_matches = face_result['matches']
            if all_matches:
                best_score = sorted(all_matches, key=lambda m: m['similarity'], reverse=True)[0]
                score = best_score['similarity']
                print(f"❌ Volto {face_idx+1}: Non riconosciuto (miglior punteggio: {score:.4f})")
            else:
                print(f"❌ Volto {face_idx+1}: Non riconosciuto (nessun confronto completato)")
            
            # Disegna rettangolo rosso
            cv2.rectangle(report_img, (x1, y1), (x2, y2), (0, 0, 255), 2)
            
            # Aggiungi etichetta
            text = "Non riconosciuto"
            text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
            cv2.rectangle(report_img, 
                        (x1, y1 - text_size[1] - 10), 
                        (x1 + text_size[0], y1), 
                        (0, 0, 0), 
                        -1)
            cv2.putText(report_img, text, (x1, y1 - 10),
                      cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
    
    # Salva report
    report_path = os.path.join(reports_dir, f"report_{timestamp}.jpg")
    cv2.imwrite(report_path, report_img)
    print(f"\n✅ Report salvato in: {report_path}")
    print(f"✅ Debug files salvati in: {debug_dir}")
    
    return True

# Esecuzione principale
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Test matching studenti')
    parser.add_argument('image_path', help='Percorso dell\'immagine')
    parser.add_argument('--students', help='File JSON studenti')
    args = parser.parse_args()
    
    test_student_matching(args.image_path, args.students)