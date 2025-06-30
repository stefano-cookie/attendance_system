"""
Sistema Face Detection per Attendance System
Versione semplificata e ottimizzata per evitare timeout
"""

import os
import cv2
import numpy as np
import json
import sys
import argparse
import time
from datetime import datetime
import logging

# Configurazione ambiente per performance
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
os.environ['TF_FORCE_GPU_ALLOW_GROWTH'] = 'true'

# Configurazione logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('FaceDetection')

try:
    from deepface import DeepFace
    logger.info("✅ DeepFace importato correttamente")
except ImportError as e:
    logger.error(f"❌ DeepFace non disponibile: {e}")
    print(json.dumps({"error": "DeepFace non installato"}))
    sys.exit(1)

class FaceDetectionSystem:
    def __init__(self, image_path, students_data_path=None):
        logger.info("🚀 Inizializzazione Face Detection System")
        
        self.image_path = image_path
        self.students_data_path = students_data_path
        
        # Usa solo VGG-Face per velocità e stabilità
        self.model_name = "VGG-Face"
        self.similarity_threshold = 0.40  # Soglia più permissiva per camera IP
        
        # Directory per output
        self.project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.output_dir = os.path.join(self.project_root, "temp", "face_output")
        self.debug_dir = os.path.join(self.project_root, "temp", "debug_detection")
        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(self.debug_dir, exist_ok=True)
        
        logger.info(f"📊 Config: Modello={self.model_name}, Soglia={self.similarity_threshold}")
        
        # Pre-carica il modello una volta sola
        self._initialize_model()
    
    def _initialize_model(self):
        """Inizializza il modello una volta per evitare reload multipli"""
        try:
            logger.info("🔄 Caricamento modello VGG-Face...")
            # Test veloce del modello
            test_img = np.zeros((224, 224, 3), dtype=np.uint8)
            DeepFace.represent(
                img_path=test_img,
                model_name=self.model_name,
                enforce_detection=False,
                detector_backend="skip"
            )
            logger.info("✅ Modello VGG-Face pronto")
        except Exception as e:
            logger.error(f"❌ Errore inizializzazione modello: {e}")
            raise
    
    def load_students(self):
        """Carica dati studenti dal JSON"""
        if not self.students_data_path or not os.path.exists(self.students_data_path):
            logger.warning("⚠️  Nessun file studenti trovato")
            return []
        
        try:
            with open(self.students_data_path, 'r', encoding='utf-8') as f:
                students = json.load(f)
            
            logger.info(f"👥 Caricati {len(students)} studenti")
            
            # Prepara embeddings per ogni studente
            valid_students = []
            for student in students:
                if 'photoPath' in student and os.path.exists(student['photoPath']):
                    try:
                        # Genera embedding per lo studente
                        embedding = self._get_face_embedding(student['photoPath'])
                        if embedding is not None:
                            student['embedding'] = embedding.tolist()
                            valid_students.append(student)
                            logger.info(f"✅ {student['name']} {student.get('surname', '')} - embedding generato")
                    except Exception as e:
                        logger.warning(f"⚠️  Errore embedding per {student['name']}: {str(e)}")
                
            logger.info(f"✅ Studenti validi con embedding: {len(valid_students)}")
            return valid_students
            
        except Exception as e:
            logger.error(f"❌ Errore caricamento studenti: {e}")
            return []
    
    def _get_face_embedding(self, image_path):
        """Genera embedding per un'immagine"""
        try:
            result = DeepFace.represent(
                img_path=image_path,
                model_name=self.model_name,
                enforce_detection=False,
                detector_backend="skip",
                align=True
            )
            
            if isinstance(result, list) and len(result) > 0:
                return np.array(result[0]['embedding'])
            return None
            
        except Exception as e:
            logger.debug(f"Errore embedding: {e}")
            return None
    
    def detect_faces(self, image):
        """Rileva volti nell'immagine usando OpenCV"""
        try:
            # Usa OpenCV per rilevamento veloce
            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
            
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            # Prova parametri più bilanciati per rilevare volti reali
            faces = face_cascade.detectMultiScale(
                gray, 
                scaleFactor=1.1,  # Più sensibile per catturare più volti
                minNeighbors=4,   # Bilanciato tra precisione e sensibilità
                minSize=(40, 40), # Volti più piccoli accettati
                maxSize=(500, 500)  # Volti più grandi accettati
            )
            
            logger.info(f"🔍 OpenCV ha rilevato {len(faces)} possibili volti")
            
            # Se non trova volti con parametri standard, prova parametri più aggressivi
            if len(faces) == 0:
                logger.info("🔄 Tentativo con parametri più aggressivi...")
                faces = face_cascade.detectMultiScale(
                    gray, 
                    scaleFactor=1.05,  # Molto sensibile
                    minNeighbors=3,    # Meno restrittivo
                    minSize=(30, 30),  # Volti molto piccoli
                    maxSize=(600, 600) # Volti molto grandi
                )
                logger.info(f"🔍 Tentativo aggressivo: {len(faces)} volti rilevati")
            
            face_data = []
            for i, (x, y, w, h) in enumerate(faces):
                # Estrai volto con padding
                padding = int(max(w, h) * 0.2)
                x1 = max(0, x - padding)
                y1 = max(0, y - padding)
                x2 = min(image.shape[1], x + w + padding)
                y2 = min(image.shape[0], y + h + padding)
                
                face_img = image[y1:y2, x1:x2]
                
                # Genera embedding per il volto
                try:
                    embedding = self._get_face_embedding(face_img)
                    if embedding is not None:
                        face_data.append({
                            'index': i,
                            'bbox': {'x': x, 'y': y, 'w': w, 'h': h},
                            'embedding': embedding
                        })
                except:
                    pass
            
            logger.info(f"👤 Rilevati {len(faces)} volti, {len(face_data)} con embedding valido")
            return face_data
            
        except Exception as e:
            logger.error(f"❌ Errore rilevamento volti: {e}")
            return []
    
    def match_faces(self, faces, students):
        """Confronta volti rilevati con studenti"""
        recognized = []
        
        for face in faces:
            best_match = None
            best_similarity = 0
            
            face_embedding = face['embedding']
            
            for student in students:
                if 'embedding' not in student:
                    continue
                
                try:
                    # Calcola similarità coseno
                    student_embedding = np.array(student['embedding'])
                    
                    # Normalizza vettori
                    face_norm = face_embedding / np.linalg.norm(face_embedding)
                    student_norm = student_embedding / np.linalg.norm(student_embedding)
                    
                    # Similarità coseno
                    similarity = np.dot(face_norm, student_norm)
                    
                    if similarity > best_similarity and similarity > self.similarity_threshold:
                        best_similarity = similarity
                        best_match = student
                        
                except Exception as e:
                    logger.debug(f"Errore confronto: {e}")
                    continue
            
            if best_match:
                recognized.append({
                    'userId': best_match['id'],
                    'name': best_match['name'],
                    'surname': best_match.get('surname', ''),
                    'confidence': float(best_similarity),
                    'faceIndex': face['index']
                })
                logger.info(f"✅ Riconosciuto: {best_match['name']} (confidence: {best_similarity:.3f})")
        
        return recognized
    
    def generate_report_image(self, image, faces, recognized):
        """Genera immagine report con volti evidenziati"""
        report_img = image.copy()
        
        # Mappa riconoscimenti per face index
        recognized_map = {r['faceIndex']: r for r in recognized}
        
        for face in faces:
            bbox = face['bbox']
            x, y, w, h = bbox['x'], bbox['y'], bbox['w'], bbox['h']
            
            if face['index'] in recognized_map:
                # Verde per riconosciuti
                color = (0, 255, 0)
                thickness = 3
                rec = recognized_map[face['index']]
                label = f"{rec['name']} {rec['surname']}"
                confidence = f"{rec['confidence']:.1%}"
                
                # Background per testo
                cv2.rectangle(report_img, (x, y-35), (x+200, y), (0, 200, 0), -1)
                cv2.putText(report_img, label, (x+5, y-20), 
                          cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                cv2.putText(report_img, confidence, (x+5, y-5), 
                          cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
            else:
                # Rosso per non riconosciuti
                color = (0, 0, 255)
                thickness = 2
                cv2.putText(report_img, "Non identificato", (x, y-10),
                          cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
            
            # Disegna rettangolo
            cv2.rectangle(report_img, (x, y), (x+w, y+h), color, thickness)
        
        # Salva report
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_path = os.path.join(self.output_dir, f"report_{timestamp}.jpg")
        cv2.imwrite(report_path, report_img)
        
        return report_path
    
    def process_image(self):
        """Processa immagine completa"""
        start_time = time.time()
        
        try:
            # 1. Carica immagine
            if not os.path.exists(self.image_path):
                raise Exception(f"Immagine non trovata: {self.image_path}")
            
            image = cv2.imread(self.image_path)
            if image is None:
                raise Exception("Errore caricamento immagine")
            
            logger.info(f"✅ Immagine caricata: {image.shape}")
            
            # Salva immagine originale per debug
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            debug_original = os.path.join(self.debug_dir, f"original_{timestamp}.jpg")
            cv2.imwrite(debug_original, image)
            logger.info(f"🔍 Immagine debug salvata: {debug_original}")
            
            # 2. Carica studenti
            students = self.load_students()
            
            # 3. Rileva volti
            faces = self.detect_faces(image)
            
            # 4. Riconosci studenti
            recognized = []
            if len(faces) > 0 and len(students) > 0:
                recognized = self.match_faces(faces, students)
            
            # 5. Genera report
            report_path = ""
            if len(faces) > 0:
                logger.info(f"🖼️ Generazione report per {len(faces)} volti...")
                report_path = self.generate_report_image(image, faces, recognized)
                logger.info(f"✅ Report generato: {report_path}")
                logger.info(f"📁 File esiste: {os.path.exists(report_path) if report_path else 'NO PATH'}")
            else:
                logger.warning("⚠️ Nessun volto rilevato, nessun report generato")
            
            # 6. Risultato finale
            processing_time = time.time() - start_time
            
            result = {
                "timestamp": datetime.now().isoformat(),
                "image_file": os.path.basename(self.image_path),
                "detected_faces": len(faces),
                "recognized_students": recognized,
                "report_image": report_path,
                "attendance_stats": {
                    "total_students": len(students),
                    "present_count": len(recognized),
                    "absent_count": len(students) - len(recognized),
                    "attendance_rate": (len(recognized) / len(students) * 100) if students else 0
                },
                "processing_info": {
                    "processing_time": processing_time,
                    "model_used": self.model_name,
                    "threshold": self.similarity_threshold
                },
                "status": "success"
            }
            
            logger.info(f"✅ Elaborazione completata in {processing_time:.2f}s")
            logger.info(f"📊 Risultato: {len(faces)} volti, {len(recognized)} riconosciuti")
            
            return json.dumps(result, indent=2)
            
        except Exception as e:
            logger.error(f"❌ Errore elaborazione: {str(e)}")
            return json.dumps({
                "error": str(e),
                "timestamp": datetime.now().isoformat(),
                "processing_time": time.time() - start_time,
                "detected_faces": 0,
                "recognized_students": [],
                "status": "error"
            })

def main():
    parser = argparse.ArgumentParser(description='Face Detection System')
    parser.add_argument('image_path', help='Percorso immagine da analizzare')
    parser.add_argument('--output', help='File output JSON')
    parser.add_argument('--students', help='File JSON con dati studenti')
    parser.add_argument('--debug', action='store_true', help='Modalità debug')
    
    args = parser.parse_args()
    
    if args.debug:
        logger.setLevel(logging.DEBUG)
    
    logger.info("=" * 50)
    logger.info("FACE DETECTION SYSTEM v2.0")
    logger.info("=" * 50)
    
    try:
        # Crea sistema detection
        detector = FaceDetectionSystem(args.image_path, args.students)
        
        # Processa immagine
        result = detector.process_image()
        
        # Salva output se richiesto
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(result)
            logger.info(f"✅ Output salvato: {args.output}")
        
        # Stampa risultato
        print(result)
        
    except Exception as e:
        logger.error(f"❌ Errore critico: {str(e)}")
        error_result = json.dumps({"error": str(e), "status": "critical_error"})
        print(error_result)
        sys.exit(1)

if __name__ == "__main__":
    main()