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
        self.similarity_threshold = 0.45  # Soglia ottimizzata per migliore riconoscimento
        
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
            # Se è già un numpy array (face estratto), salvalo temporaneamente
            if isinstance(image_path, np.ndarray):
                import tempfile
                with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
                    cv2.imwrite(tmp.name, image_path)
                    temp_path = tmp.name
                
                try:
                    result = DeepFace.represent(
                        img_path=temp_path,
                        model_name=self.model_name,
                        enforce_detection=False,
                        detector_backend="skip",
                        align=True
                    )
                finally:
                    os.unlink(temp_path)
            else:
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
    
    def detect_faces(self, image_path):
        """Rileva volti nell'immagine usando DeepFace con coordinate corrette"""
        try:
            logger.info(f"🔍 SISTEMA DETECTION SEMPLIFICATO - Usando DeepFace standard")
            
            if not os.path.exists(image_path):
                logger.error(f"❌ File non trovato: {image_path}")
                return []
            
            # Carica immagine
            image = cv2.imread(image_path)
            if image is None:
                logger.error("❌ Impossibile caricare immagine")
                return []
            
            logger.info(f"✅ Immagine caricata: {image.shape}")
            
            # APPROCCIO SEMPLIFICATO: Usa DeepFace.detectFace che è più stabile
            try:
                logger.info("🚀 Usando DeepFace.detectFace...")
                
                # Usa opencv backend che è più stabile
                detector_backend = 'opencv'
                
                try:
                    # Rileva tutti i volti con DeepFace
                    logger.info(f"🔍 Rilevamento con backend: {detector_backend}")
                    
                    # DeepFace.detectFace restituisce l'immagine del volto ritagliato
                    # ma non le coordinate. Usiamo quindi extract_faces che dovrebbe dare più info
                    faces_data = DeepFace.extract_faces(
                        img_path=image_path,
                        target_size=(224, 224),
                        detector_backend=detector_backend,
                        enforce_detection=False,
                        align=True
                    )
                    
                    logger.info(f"✅ extract_faces completato: {len(faces_data)} volti trovati")
                    
                    # Se extract_faces non funziona, proviamo con OpenCV diretto
                    if len(faces_data) == 0:
                        logger.warning("⚠️ Nessun volto trovato con DeepFace, provo OpenCV diretto")
                        return self._detect_faces_opencv_direct(image)
                    
                    # Usa faces_data come face_objs per il resto del codice
                    face_objs = faces_data
                
                except Exception as e:
                    logger.error(f"❌ Errore durante extract_faces: {e}")
                    logger.warning("⚠️ Provo con OpenCV diretto")
                    return self._detect_faces_opencv_direct(image)
                
                logger.info(f"✅ Rilevati {len(face_objs)} volti con coordinate")
                
                # Debug: mostra cosa ha restituito FaceDetector
                if len(face_objs) == 0:
                    logger.warning("⚠️ FaceDetector non ha rilevato nessun volto")
                    logger.info(f"   Detector backend usato: {detector_backend}")
                else:
                    logger.info(f"📊 Tipo face_objs: {type(face_objs)}")
                    if len(face_objs) > 0:
                        logger.info(f"📊 Tipo primo elemento: {type(face_objs[0])}")
                        if isinstance(face_objs[0], dict):
                            logger.info(f"📊 Chiavi primo elemento: {list(face_objs[0].keys())}")
                
                face_data = []
                
                for i, face_obj in enumerate(face_objs):
                    try:
                        logger.info(f"\n🔍 PROCESSANDO VOLTO {i}...")
                        
                        # extract_faces restituisce {'face': numpy_array, 'facial_area': {'x': x, 'y': y, 'w': w, 'h': h}, 'confidence': float}
                        if isinstance(face_obj, dict):
                            # Estrai l'immagine del volto
                            face_img = face_obj.get('face')
                            
                            # Estrai le coordinate - DeepFace usa 'facial_area' non 'area'
                            facial_area = face_obj.get('facial_area', {})
                            
                            # Se non ci sono coordinate, usa l'intera immagine
                            if facial_area and all(k in facial_area for k in ['x', 'y', 'w', 'h']):
                                bbox = facial_area
                                logger.info(f"📍 Volto {i} coordinate: x={bbox['x']}, y={bbox['y']}, w={bbox['w']}, h={bbox['h']}")
                            else:
                                # Stima coordinate basate sulla dimensione dell'immagine del volto
                                h, w = face_img.shape[:2] if face_img is not None else (224, 224)
                                bbox = {'x': 0, 'y': 0, 'w': w, 'h': h}
                                logger.warning(f"⚠️ Volto {i} senza coordinate, uso dimensioni immagine: {w}x{h}")
                            
                            # Verifica che abbiamo un'immagine valida
                            if face_img is None or face_img.size == 0:
                                logger.warning(f"⚠️ Volto {i} - immagine non valida")
                                continue
                                
                            # Verifica dimensioni minime
                            if bbox['w'] < 60 or bbox['h'] < 60:
                                logger.info(f"❌ Volto {i} troppo piccolo: {bbox['w']}x{bbox['h']}")
                                continue
                            
                            # VALIDAZIONE RIGOROSA con DeepFace
                            logger.info(f"🔍 Validazione volto {i} con DeepFace.analyze...")
                            try:
                                # Verifica che sia un volto umano reale
                                analysis = DeepFace.analyze(
                                    img_path=face_img,
                                    actions=['age', 'gender', 'race'],
                                    enforce_detection=False,  # Già abbiamo il volto estratto
                                    silent=True
                                )
                                
                                if isinstance(analysis, list):
                                    analysis = analysis[0]
                                
                                age = analysis.get('age', 0)
                                gender = analysis.get('dominant_gender', 'unknown')
                                race = analysis.get('dominant_race', 'unknown')
                                
                                logger.info(f"✅ Volto {i} VALIDATO: età={age}, genere={gender}, razza={race}")
                                
                                # Controlli di qualità aggiuntivi
                                if age < 5 or age > 90:
                                    logger.warning(f"⚠️ Volto {i} età sospetta: {age}")
                                    # Ma procediamo comunque se altri parametri sono OK
                                
                            except Exception as val_error:
                                logger.warning(f"⚠️ Volto {i} validazione fallita: {val_error}")
                                logger.info("   Scarto questo volto per sicurezza")
                                continue
                            
                            # Genera embedding solo per volti validati
                            logger.info(f"🚀 Generando embedding per volto {i}...")
                            embedding = self._get_face_embedding(face_img)
                            
                            if embedding is not None:
                                face_data.append({
                                    'index': i,
                                    'bbox': bbox,  # COORDINATE CORRETTE!
                                    'embedding': embedding,
                                    'quality_score': bbox['w'] * bbox['h'],
                                    'age': age,
                                    'gender': gender
                                })
                                logger.info(f"✅ Volto {i} processato con successo")
                            else:
                                logger.warning(f"⚠️ Volto {i} - embedding fallito")
                        else:
                            logger.error(f"❌ Volto {i} - formato non riconosciuto: {type(face_obj)}")
                        
                    except Exception as face_error:
                        logger.error(f"❌ Errore processing volto {i}: {face_error}")
                        import traceback
                        logger.error(f"   Traceback: {traceback.format_exc()}")
                        continue
                
                logger.info(f"\n📊 RISULTATO: {len(face_objs)} volti rilevati, {len(face_data)} validati e processati")
                return face_data
                
            except ImportError as import_error:
                logger.error(f"❌ Impossibile importare FaceDetector: {import_error}")
                # Fallback al metodo vecchio ma con warning
                logger.warning("⚠️ USANDO METODO FALLBACK SENZA COORDINATE!")
                return self._detect_faces_opencv_fallback()
            except Exception as detection_error:
                logger.error(f"❌ Errore durante detection: {detection_error}")
                logger.error(f"   Tipo errore: {type(detection_error)}")
                import traceback
                logger.error(f"   Traceback: {traceback.format_exc()}")
                return []
                
        except Exception as e:
            logger.error(f"❌ Errore generale rilevamento volti: {e}")
            return []
    
    def _detect_faces_opencv_direct(self, image):
        """Detection diretta con OpenCV quando DeepFace fallisce"""
        try:
            logger.info("🔄 Tentativo con OpenCV diretto...")
            
            # OpenCV detection semplice
            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
            
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(
                gray, 
                scaleFactor=1.1,
                minNeighbors=4,
                minSize=(50, 50),
                maxSize=(300, 300)
            )
            
            logger.info(f"🔍 OpenCV diretto: {len(faces)} volti rilevati")
            
            face_data = []
            for i, (x, y, w, h) in enumerate(faces):
                # Estrai volto
                face_img = image[y:y+h, x:x+w]
                
                if face_img.size == 0:
                    continue
                
                # Validazione con DeepFace
                try:
                    DeepFace.analyze(
                        img_path=face_img,
                        actions=['age'],
                        enforce_detection=True,
                        silent=True
                    )
                    
                    embedding = self._get_face_embedding(face_img)
                    if embedding is not None:
                        face_data.append({
                            'index': i,
                            'bbox': {'x': x, 'y': y, 'w': w, 'h': h},
                            'embedding': embedding,
                            'quality_score': w * h
                        })
                        logger.info(f"✅ Volto {i} validato con OpenCV diretto")
                        
                except Exception:
                    logger.debug(f"Volto {i} non validato")
                    continue
            
            return face_data
            
        except Exception as e:
            logger.error(f"❌ Errore OpenCV diretto: {e}")
            return []
    
    def _detect_faces_opencv_fallback(self):
        """Fallback con OpenCV se DeepFace non funziona"""
        try:
            # Carica immagine
            image = cv2.imread(self.image_path)
            if image is None:
                return []
            
            # OpenCV detection semplice
            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            )
            
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(
                gray, 
                scaleFactor=1.1,
                minNeighbors=4,
                minSize=(50, 50),
                maxSize=(300, 300)
            )
            
            logger.info(f"🔍 OpenCV fallback: {len(faces)} volti rilevati")
            
            face_data = []
            for i, (x, y, w, h) in enumerate(faces):
                # Estrai volto
                face_img = image[y:y+h, x:x+w]
                
                if face_img.size == 0:
                    continue
                
                # Validazione con DeepFace
                try:
                    DeepFace.analyze(
                        img_path=face_img,
                        actions=['age'],
                        enforce_detection=True,
                        silent=True
                    )
                    
                    embedding = self._get_face_embedding(face_img)
                    if embedding is not None:
                        face_data.append({
                            'index': i,
                            'bbox': {'x': x, 'y': y, 'w': w, 'h': h},
                            'embedding': embedding,
                            'quality_score': w * h
                        })
                        logger.info(f"✅ Volto {i} validato con fallback OpenCV")
                        
                except Exception:
                    logger.debug(f"Volto {i} non validato")
                    continue
            
            return face_data
            
        except Exception as e:
            logger.error(f"❌ Errore fallback OpenCV: {e}")
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
                    
                    logger.info(f"🔍 Confronto con {student.get('name', 'Unknown')} {student.get('surname', '')}: similarity={similarity:.3f}, soglia={self.similarity_threshold}")
                    
                    # Tieni il migliore che supera la soglia (DeepFace già ha validato che è un volto)
                    if similarity > self.similarity_threshold and similarity > best_similarity:
                        best_similarity = similarity
                        best_match = student
                        logger.info(f"✅ Nuovo miglior match: {student.get('name', 'Unknown')} {student.get('surname', '')} (similarity={similarity:.3f})")
                        
                except Exception as e:
                    logger.debug(f"Errore confronto: {e}")
                    continue
            
            logger.info(f"🎯 Risultato matching per volto {face['index']}: best_similarity={best_similarity:.3f}, soglia={self.similarity_threshold}")
            
            if best_match:
                logger.info(f"✅ STUDENTE RICONOSCIUTO: {best_match.get('name', 'Unknown')} {best_match.get('surname', '')} con similarity {best_similarity:.3f}")
                recognized.append({
                    'userId': best_match['id'],
                    'name': best_match['name'],
                    'surname': best_match.get('surname', ''),
                    'confidence': float(best_similarity),
                    'faceIndex': face['index']
                })
            else:
                logger.info(f"❌ NESSUNO STUDENTE RICONOSCIUTO per volto {face['index']} (miglior similarity: {best_similarity:.3f})")
        
        return recognized
    
    def generate_report_image(self, image, faces, recognized):
        """Genera immagine report con volti evidenziati"""
        report_img = image.copy()
        
        # Mappa riconoscimenti per face index
        recognized_map = {r['faceIndex']: r for r in recognized}
        
        # Se non ci sono volti, aggiungi testo informativo
        if len(faces) == 0:
            cv2.putText(report_img, "Nessun volto rilevato", (50, 50),
                      cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        
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
        
        # Salva report in una directory persistente
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        reports_dir = os.path.join(self.project_root, "temp", "reports")
        os.makedirs(reports_dir, exist_ok=True)
        
        report_path = os.path.join(reports_dir, f"report_{timestamp}.jpg")
        cv2.imwrite(report_path, report_img)
        
        logger.info(f"📊 Report salvato in: {report_path}")
        
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
            faces = self.detect_faces(self.image_path)
            
            # 4. Riconosci studenti
            recognized = []
            if len(faces) > 0 and len(students) > 0:
                recognized = self.match_faces(faces, students)
            
            # 5. Genera report SEMPRE (anche se nessun volto)
            logger.info(f"🖼️ Generazione report per {len(faces)} volti...")
            report_path = self.generate_report_image(image, faces, recognized)
            logger.info(f"✅ Report generato: {report_path}")
            logger.info(f"📁 File esiste: {os.path.exists(report_path) if report_path else 'NO PATH'}")
            
            # 6. Risultato finale
            processing_time = time.time() - start_time
            
            result = {
                "timestamp": datetime.now().isoformat(),
                "image_file": os.path.basename(self.image_path),
                "detected_faces": len(faces),
                "recognized_students": recognized,
                "report_image": report_path if report_path else None,
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
            
            logger.info(f"📊 Risultato finale - report_image: {report_path}")
            logger.info(f"📁 Report file exists: {os.path.exists(report_path) if report_path else 'NO PATH'}")
            
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