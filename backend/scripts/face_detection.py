"""
Face Detection System v4.0 - Production Optimized
Utilizza RetinaFace + Facenet512 per accuratezza 98%+
Mantiene compatibilità con interfaccia esistente mentre migra gradualmente a BLOB-native
"""

import os
import cv2
import numpy as np
import json
import sys
import argparse
import time
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple, Union
from dataclasses import dataclass
import logging
import warnings

# Sopprimi warning TensorFlow
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
warnings.filterwarnings('ignore')

# Configurazione logging strutturato
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('FaceDetectionV4')

try:
    # Fix per compatibilità TensorFlow
    import tensorflow as tf
    if not hasattr(tf, 'keras'):
        import keras
        tf.keras = keras
    
    from deepface import DeepFace
    
    # Con DeepFace 0.0.93, non sono necessari workaround!
    
    logger.info("✅ DeepFace importato correttamente")
except ImportError as e:
    logger.error(f"❌ DeepFace non disponibile: {e}")
    print(json.dumps({"error": "DeepFace non installato", "status": "critical_error"}))
    sys.exit(1)

@dataclass
class PerformanceMetrics:
    """Metriche di performance per monitoring"""
    detection_time_ms: float = 0
    recognition_time_ms: float = 0
    total_time_ms: float = 0
    memory_peak_mb: float = 0
    cache_hit_rate: float = 0
    faces_processed: int = 0
    
class EmbeddingCache:
    """Cache intelligente per embeddings con TTL e versioning"""
    
    def __init__(self, ttl_seconds: int = 3600, max_size: int = 1000):
        self.cache: Dict[str, Tuple[np.ndarray, datetime, str]] = {}
        self.ttl = timedelta(seconds=ttl_seconds)
        self.max_size = max_size
        self.hits = 0
        self.misses = 0
        
    def _get_key(self, user_id: int, model_name: str) -> str:
        """Genera chiave univoca per cache"""
        return f"{user_id}_{model_name}"
    
    def get(self, user_id: int, model_name: str, photo_hash: str) -> Optional[np.ndarray]:
        """Recupera embedding dalla cache se valido"""
        key = self._get_key(user_id, model_name)
        
        if key in self.cache:
            embedding, timestamp, cached_hash = self.cache[key]
            
            # Verifica TTL e hash foto
            if (datetime.now() - timestamp < self.ttl and 
                cached_hash == photo_hash):
                self.hits += 1
                logger.debug(f"Cache HIT per user {user_id}")
                return embedding
        
        self.misses += 1
        return None
    
    def set(self, user_id: int, model_name: str, embedding: np.ndarray, photo_hash: str):
        """Salva embedding in cache"""
        # Rimuovi vecchie entry se necessario
        if len(self.cache) >= self.max_size:
            oldest_key = min(self.cache.keys(), 
                           key=lambda k: self.cache[k][1])
            del self.cache[oldest_key]
        
        key = self._get_key(user_id, model_name)
        self.cache[key] = (embedding, datetime.now(), photo_hash)
        
    def get_hit_rate(self) -> float:
        """Calcola hit rate della cache"""
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0
    
    def clear_expired(self):
        """Rimuovi entry scadute"""
        now = datetime.now()
        expired_keys = [
            k for k, (_, timestamp, _) in self.cache.items()
            if now - timestamp >= self.ttl
        ]
        for key in expired_keys:
            del self.cache[key]

class FaceDetectionSystem:
    """Sistema Face Detection ottimizzato con RetinaFace + Facenet512"""
    
    def __init__(self, image_path: str = None, students_data_path: str = None, 
                 config_path: str = None):
        """
        Inizializza sistema con configurazione avanzata
        
        Args:
            image_path: Path immagine da analizzare (legacy support)
            students_data_path: Path JSON studenti (legacy support)
            config_path: Path file configurazione JSON
        """
        self.start_time = time.time()
        logger.info("🚀 Inizializzazione Face Detection System v4.0")
        
        # Legacy support
        self.image_path = image_path
        self.students_data_path = students_data_path
        
        # Carica configurazione
        self.config = self._load_config(config_path)
        
        # Estrai parametri principali
        self.detector_backend = self.config["models"]["detector"]["backend"]
        self.model_name = self.config["models"]["recognizer"]["model_name"]
        self.similarity_threshold = self.config["models"]["recognizer"]["similarity_threshold"]
        self.enable_caching = self.config["performance"]["enable_caching"]
        
        # Directory setup
        self.project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.output_dir = os.path.join(self.project_root, "temp", "face_output")
        self.debug_dir = os.path.join(self.project_root, "temp", "debug_detection")
        
        # Solo se debug è abilitato
        if self.config["output"]["save_debug_images"]:
            os.makedirs(self.output_dir, exist_ok=True)
            os.makedirs(self.debug_dir, exist_ok=True)
        
        # Inizializza cache
        self.embedding_cache = EmbeddingCache(
            ttl_seconds=self.config["performance"]["cache_duration"],
            max_size=self.config["performance"]["cache_max_size"]
        )
        
        # Inizializza metriche
        self.metrics = PerformanceMetrics()
        
        # Debug mode per salvare immagini
        self.save_debug_faces = self.config["output"].get("save_debug_images", False)
        self.debug_faces_dir = os.path.join(self.project_root, "temp", "debug_faces")
        if self.save_debug_faces:
            os.makedirs(self.debug_faces_dir, exist_ok=True)
        
        # Pre-carica modelli
        try:
            self._initialize_models()
        except Exception as e:
            logger.warning(f"⚠️ Pre-caricamento modelli parziale: {e}")
            logger.info("ℹ️ I modelli verranno caricati al primo utilizzo")
        
        logger.info(f"📊 Configurazione:")
        logger.info(f"   - Detector: {self.detector_backend}")
        logger.info(f"   - Recognizer: {self.model_name}")
        logger.info(f"   - Threshold: {self.similarity_threshold}")
        logger.info(f"   - Caching: {'Enabled' if self.enable_caching else 'Disabled'}")
        
    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        """Carica configurazione da file o usa default"""
        default_config_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 
            "config", 
            "face_detection_config.json"
        )
        
        config_file = config_path or default_config_path
        
        try:
            if os.path.exists(config_file):
                with open(config_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"⚠️ Errore caricamento config: {e}, uso default")
        
        # Default configuration fallback
        return {
            "models": {
                "detector": {
                    "backend": "retinaface",
                    "confidence_threshold": 0.5,
                    "target_size": [224, 224],
                    "enforce_detection": False,
                    "align": True
                },
                "recognizer": {
                    "model_name": "Facenet512",
                    "similarity_threshold": 0.28,
                    "distance_metric": "cosine"
                }
            },
            "performance": {
                "max_processing_time": 30,
                "enable_caching": True,
                "cache_duration": 3600,
                "cache_max_size": 1000,
                "memory_limit_mb": 1024
            },
            "output": {
                "save_debug_images": False,
                "structured_logging": True,
                "include_confidence_map": True
            }
        }
    
    def _initialize_models(self):
        """Pre-carica modelli per evitare latenza al primo uso"""
        try:
            init_start = time.time()
            logger.info("🔄 Pre-caricamento modelli...")
            
            # Crea dummy image file per warm-up (workaround per numpy array issues)
            import tempfile
            dummy_img = np.zeros((224, 224, 3), dtype=np.uint8)
            dummy_img[50:150, 50:150] = 255  # Quadrato bianco
            
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
                cv2.imwrite(tmp.name, dummy_img)
                dummy_path = tmp.name
            
            try:
                # Pre-carica detector
                logger.info(f"   Loading {self.detector_backend} detector...")
                try:
                    DeepFace.extract_faces(
                        img_path=dummy_path,
                        detector_backend=self.detector_backend,
                        enforce_detection=False
                    )
                    logger.info(f"   ✅ {self.detector_backend} pronto")
                except Exception as e:
                    logger.warning(f"⚠️ {self.detector_backend} ha problemi: {e}")
                    # Prova MTCNN come alternativa di alta qualità
                    try:
                        logger.info("🔄 Tentativo con MTCNN (alta precisione)...")
                        DeepFace.extract_faces(
                            img_path=dummy_path,
                            detector_backend='mtcnn',
                            enforce_detection=False
                        )
                        self.detector_backend = 'mtcnn'
                        logger.info("✅ MTCNN pronto - usando come detector principale")
                    except:
                        logger.error(f"❌ Nessun detector di alta precisione disponibile")
                        raise Exception(f"Nessun detector di alta precisione disponibile")
                
                # Pre-carica recognition model
                logger.info(f"   Loading {self.model_name} model...")
                try:
                    DeepFace.represent(
                        img_path=dummy_path,
                        model_name=self.model_name,
                        enforce_detection=False,
                        detector_backend="skip"
                    )
                    logger.info(f"   ✅ {self.model_name} pronto")
                except Exception as e:
                    logger.warning(f"⚠️ {self.model_name} pre-caricamento fallito: {e}")
                    logger.info("   Il modello verrà caricato al primo uso")
            finally:
                # Cleanup dummy file
                if os.path.exists(dummy_path):
                    os.unlink(dummy_path)
            
            # Se abilitata doppia verifica, carica anche modello secondario
            if self.config["models"].get("verification", {}).get("enable_double_check", False):
                secondary_model = self.config["models"]["verification"]["secondary_model"]
                logger.info(f"   Loading {secondary_model} (verification)...")
                with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp2:
                    cv2.imwrite(tmp2.name, dummy_img)
                    dummy_path2 = tmp2.name
                try:
                    DeepFace.represent(
                        img_path=dummy_path2,
                        model_name=secondary_model,
                        enforce_detection=False,
                        detector_backend="skip"
                    )
                    logger.info(f"   ✅ {secondary_model} pronto")
                except Exception as e:
                    logger.warning(f"⚠️ {secondary_model} pre-caricamento fallito: {e}")
                finally:
                    if os.path.exists(dummy_path2):
                        os.unlink(dummy_path2)
            
            init_time = (time.time() - init_start) * 1000
            logger.info(f"✅ Modelli inizializzati in {init_time:.0f}ms")
            
        except Exception as e:
            logger.error(f"❌ Errore inizializzazione modelli: {e}")
            raise
    
    def _calculate_photo_hash(self, photo_data: Union[str, bytes, np.ndarray]) -> str:
        """Calcola hash univoco per foto (per cache invalidation)"""
        if isinstance(photo_data, str):
            # File path
            if os.path.exists(photo_data):
                with open(photo_data, 'rb') as f:
                    data = f.read()
            else:
                return ""
        elif isinstance(photo_data, np.ndarray):
            data = photo_data.tobytes()
        else:
            data = photo_data
            
        return hashlib.md5(data).hexdigest()
    
    def load_students(self) -> List[Dict[str, Any]]:
        """Carica studenti con generazione batch embeddings"""
        if not self.students_data_path or not os.path.exists(self.students_data_path):
            logger.warning("⚠️ Nessun file studenti trovato")
            return []
        
        logger.info(f"\n{'='*60}")
        logger.info(f"🎓 CARICAMENTO STUDENTI")
        logger.info(f"📂 File: {self.students_data_path}")
        logger.info(f"{'='*60}")
        
        try:
            load_start = time.time()
            
            with open(self.students_data_path, 'r', encoding='utf-8') as f:
                students = json.load(f)
            
            logger.info(f"👥 Caricati {len(students)} studenti dal JSON")
            
            # Prepara batch per embedding generation
            valid_students = []
            embeddings_to_generate = []
            
            for student in students:
                if 'photoPath' not in student or not os.path.exists(student['photoPath']):
                    logger.warning(f"⚠️ Foto mancante per {student.get('name', 'Unknown')}")
                    continue
                
                # Calcola hash foto per cache validation
                photo_hash = self._calculate_photo_hash(student['photoPath'])
                student['photo_hash'] = photo_hash
                
                # Controlla cache
                if self.enable_caching:
                    cached_embedding = self.embedding_cache.get(
                        student['id'], 
                        self.model_name,
                        photo_hash
                    )
                    
                    if cached_embedding is not None:
                        student['embedding'] = cached_embedding.tolist()
                        student['embedding_cached'] = True
                        valid_students.append(student)
                        continue
                
                # Aggiungi a batch per generazione
                embeddings_to_generate.append(student)
            
            # Genera embeddings in batch
            if embeddings_to_generate:
                logger.info(f"🔄 Generazione embeddings per {len(embeddings_to_generate)} studenti...")
                
                batch_size = self.config["models"]["recognizer"].get("batch_size", 32)
                
                for i in range(0, len(embeddings_to_generate), batch_size):
                    batch = embeddings_to_generate[i:i + batch_size]
                    
                    for student in batch:
                        try:
                            # Verifica validità foto
                            logger.debug(f"📸 Verificando foto: {student['photoPath']}")
                            
                            # Prima verifica che il file esista e sia leggibile
                            test_img = cv2.imread(student['photoPath'])
                            if test_img is None:
                                logger.error(f"❌ Impossibile leggere foto di {student['name']}")
                                continue
                            
                            logger.debug(f"   Dimensioni foto: {test_img.shape}")
                            
                            # Prova con il detector configurato
                            try:
                                faces = DeepFace.extract_faces(
                                    img_path=student['photoPath'],
                                    detector_backend=self.detector_backend,
                                    enforce_detection=False,
                                    align=True
                                )
                            except AttributeError as e:
                                # Se RetinaFace fallisce con l'errore tuple, prova MTCNN
                                if "'tuple' object has no attribute 'shape'" in str(e) and self.detector_backend != 'mtcnn':
                                    logger.warning(f"⚠️ {self.detector_backend} ha problemi con questa versione di DeepFace, uso MTCNN")
                                    faces = DeepFace.extract_faces(
                                        img_path=student['photoPath'],
                                        detector_backend='mtcnn',
                                        enforce_detection=False,
                                        align=True
                                    )
                                else:
                                    raise
                            
                            if not faces:
                                logger.warning(f"⚠️ Nessun volto in foto di {student['name']}")
                                continue
                            
                            # Gestisci diversi formati di output di extract_faces
                            if isinstance(faces, list) and len(faces) > 0:
                                # Nuovo formato: lista di dizionari
                                if isinstance(faces[0], dict) and 'face' in faces[0]:
                                    face_image = faces[0]['face']
                                    confidence = faces[0].get('confidence', 0)
                                else:
                                    # Formato alternativo: lista di array numpy
                                    face_image = faces[0]
                                    confidence = 1.0
                            elif isinstance(faces, tuple):
                                # Vecchio formato: tupla
                                face_image = faces[0] if len(faces) > 0 else None
                                confidence = 1.0
                            else:
                                logger.warning(f"⚠️ Formato faces non riconosciuto per {student['name']}")
                                continue
                            
                            if face_image is None:
                                logger.warning(f"⚠️ Nessun volto estratto per {student['name']}")
                                continue
                                
                            logger.debug(f"   Volto estratto: shape={getattr(face_image, 'shape', 'N/A')}, confidence={confidence:.3f}")
                            
                            # Salva volto per debug
                            if self.save_debug_faces:
                                debug_filename = f"student_{student['id']}_{student['name']}_{student.get('surname', '')}.jpg"
                                debug_path = os.path.join(self.debug_faces_dir, debug_filename)
                                
                                # Converti in uint8 se necessario
                                if face_image.dtype != np.uint8:
                                    if face_image.max() <= 1.0:
                                        face_to_save = (face_image * 255).astype(np.uint8)
                                    else:
                                        face_to_save = face_image.astype(np.uint8)
                                else:
                                    face_to_save = face_image
                                
                                cv2.imwrite(debug_path, face_to_save)
                                logger.info(f"📸 Volto studente salvato: {debug_filename}")
                                
                                # Verifica che l'immagine non sia nera
                                if np.mean(face_to_save) < 5:
                                    logger.error(f"⚠️ ATTENZIONE: Volto di {student['name']} sembra essere nero/vuoto!")
                            
                            # Genera embedding principale
                            logger.info(f"🔄 Generando embedding per {student['name']} {student.get('surname', '')}")
                            
                            # 🚨 RADICAL FIX: Use original photo instead of extracted face
                            logger.error(f"🔥 USING ORIGINAL PHOTO: {student['photoPath']}")
                            
                            embedding = self._generate_embedding(
                                student['photoPath'],  # Usa la foto originale completa
                                self.model_name
                            )
                            
                            if embedding is not None:
                                student['embedding'] = embedding.tolist()
                                student['embedding_cached'] = False
                                
                                # Salva in cache
                                if self.enable_caching:
                                    self.embedding_cache.set(
                                        student['id'],
                                        self.model_name,
                                        embedding,
                                        student['photo_hash']
                                    )
                                
                                # Se doppia verifica abilitata
                                if self.config["models"].get("verification", {}).get("enable_double_check", False):
                                    secondary_model = self.config["models"]["verification"]["secondary_model"]
                                    face_image_copy2 = face_image.copy() if isinstance(face_image, np.ndarray) else face_image
                                    secondary_embedding = self._generate_embedding(
                                        face_image_copy2,  # Usa una copia anche qui
                                        secondary_model
                                    )
                                    if secondary_embedding is not None:
                                        student['embedding_secondary'] = secondary_embedding.tolist()
                                
                                valid_students.append(student)
                                logger.info(f"✅ {student['name']} {student.get('surname', '')} - embedding generato con successo")
                                
                        except Exception as e:
                            logger.error(f"❌ ERRORE CRITICO per {student['name']} {student.get('surname', '')}: {str(e)}")
                            import traceback
                            logger.error(traceback.format_exc())
            
            load_time = (time.time() - load_start) * 1000
            cache_rate = self.embedding_cache.get_hit_rate() if self.enable_caching else 0
            
            logger.info(f"✅ Studenti processati in {load_time:.0f}ms")
            logger.info(f"   - Validi: {len(valid_students)}/{len(students)}")
            logger.info(f"   - Cache hit rate: {cache_rate:.1%}")
            
            return valid_students
            
        except Exception as e:
            logger.error(f"❌ Errore caricamento studenti: {e}")
            return []
    
    def _generate_embedding(self, image_path: Union[str, np.ndarray], 
                          model_name: str) -> Optional[np.ndarray]:
        """Genera embedding con modello specificato"""
        try:
            logger.error(f"🔥 GENERATING EMBEDDING con {model_name}")
            
            # Se è un numpy array, salvalo temporaneamente come file
            # Questo evita il problema di resize_image con la versione corrente di DeepFace
            temp_path = None
            if isinstance(image_path, np.ndarray):
                logger.debug(f"   Input: numpy array {image_path.shape}")
                import tempfile
                with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
                    # Assicurati che l'immagine sia in formato BGR per cv2
                    if len(image_path.shape) == 3 and image_path.shape[2] == 3:
                        cv2.imwrite(tmp.name, image_path)
                    else:
                        cv2.imwrite(tmp.name, image_path)
                    temp_path = tmp.name
                    image_path = temp_path
            else:
                if not os.path.exists(image_path):
                    logger.error(f"❌ File non trovato per embedding: {image_path}")
                    return None
                logger.debug(f"   Path: {image_path}")
            
            # Usa direttamente il percorso file se disponibile
            if isinstance(image_path, str) and os.path.exists(image_path):
                # 🚨 FORCE FRESH MODEL LOADING - use exact same params as manual test
                result = DeepFace.represent(
                    img_path=image_path,
                    model_name=model_name,
                    enforce_detection=False,
                    detector_backend="skip"  # Removed align parameter
                )
            else:
                # Se è un numpy array, usa il percorso temporaneo già creato
                result = DeepFace.represent(
                    img_path=temp_path if 'temp_path' in locals() else image_path,
                    model_name=model_name,
                    enforce_detection=False,
                    detector_backend="skip"
                )
            
            if isinstance(result, list) and len(result) > 0:
                embedding = np.array(result[0]['embedding'])
                logger.debug(f"   ✅ Embedding generato: shape {embedding.shape}, norm {np.linalg.norm(embedding):.3f}")
                
                # 🔥 CRITICAL DEBUG: Log final embedding
                logger.error(f"🔥 RAW EMBEDDING: shape={embedding.shape}, norm={np.linalg.norm(embedding):.3f}, first3={embedding[:3]}")
                
                # Return raw embedding without forced normalization
                return embedding
            else:
                logger.warning(f"   ⚠️ Nessun embedding restituito da {model_name}")
                return None
            
        except Exception as e:
            logger.error(f"❌ Errore generazione embedding {model_name}: {e}")
            import traceback
            logger.debug(traceback.format_exc())
            return None
        finally:
            # Pulisci file temporaneo se creato
            if 'temp_path' in locals() and temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except:
                    pass
    
    def detect_faces(self, image_path: str) -> List[Dict[str, Any]]:
        """Rileva volti con RetinaFace e validazione avanzata"""
        try:
            detect_start = time.time()
            logger.info(f"🔍 Rilevamento volti con {self.detector_backend}")
            
            if not os.path.exists(image_path):
                logger.error(f"❌ File non trovato: {image_path}")
                return []
            
            # Carica e valida immagine
            image = cv2.imread(image_path)
            if image is None:
                logger.error("❌ Impossibile caricare immagine")
                return []
            
            height, width = image.shape[:2]
            logger.info(f"✅ Immagine caricata: {width}x{height}")
            
            # Controlla se immagine è troppo grande
            max_size = 2048
            if width > max_size or height > max_size:
                scale = max_size / max(width, height)
                new_width = int(width * scale)
                new_height = int(height * scale)
                image_resized = cv2.resize(image, (new_width, new_height))
                logger.info(f"📐 Immagine ridimensionata: {new_width}x{new_height}")
            else:
                image_resized = image
                scale = 1.0
            
            # Rilevamento con backend configurato
            faces_detected = []
            detector_config = self.config["models"]["detector"]
            
            try:
                # IMPORTANTE: DeepFace si aspetta un path, non un numpy array per alcuni backends
                # Salviamo temporaneamente l'immagine ridimensionata se necessario
                if scale != 1.0:
                    import tempfile
                    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
                        cv2.imwrite(tmp.name, image_resized)
                        temp_path = tmp.name
                    
                    faces_data = DeepFace.extract_faces(
                        img_path=temp_path,
                        detector_backend=self.detector_backend,
                        enforce_detection=detector_config["enforce_detection"],
                        align=detector_config["align"]
                    )
                    
                    # Rimuovi file temporaneo
                    os.unlink(temp_path)
                else:
                    # Usa il path originale se non ridimensionato
                    faces_data = DeepFace.extract_faces(
                        img_path=image_path,
                        detector_backend=self.detector_backend,
                        enforce_detection=detector_config["enforce_detection"],
                        align=detector_config["align"]
                    )
                
                logger.info(f"✅ {self.detector_backend}: {len(faces_data)} volti rilevati")
                
            except Exception as e:
                logger.error(f"❌ {self.detector_backend} fallito: {e}")
                # Se il detector principale fallisce, non compromettiamo sulla qualità
                # Proviamo MTCNN come alternativa di alta precisione
                if self.detector_backend != 'mtcnn':
                    logger.warning("🔄 Tentativo con MTCNN (alta precisione)...")
                    try:
                        faces_data = DeepFace.extract_faces(
                            img_path=image_path,
                            detector_backend='mtcnn',
                            enforce_detection=detector_config["enforce_detection"],
                            align=detector_config["align"]
                        )
                        logger.info(f"✅ MTCNN: {len(faces_data)} volti rilevati")
                        self.detector_backend = 'mtcnn'  # Usa MTCNN per questa sessione
                    except Exception as e2:
                        logger.error(f"❌ Anche MTCNN fallito: {e2}")
                        logger.error("⛔ ERRORE CRITICO: Nessun detector di alta precisione disponibile")
                        return []  # Restituisce lista vuota invece di crashare
                else:
                    logger.error("⛔ ERRORE CRITICO: Rilevamento volti impossibile")
                    return []  # Restituisce lista vuota invece di crashare
            
            # Processa e valida ogni volto
            validation_config = self.config.get("validation", {})
            min_face_size = validation_config.get("min_face_size", [80, 80])
            max_face_size = validation_config.get("max_face_size", [500, 500])
            min_confidence = validation_config.get("min_face_confidence", 0.90)
            
            # Normalizza faces_data in un formato consistente
            normalized_faces = []
            if isinstance(faces_data, list):
                for item in faces_data:
                    if isinstance(item, dict):
                        normalized_faces.append(item)
                    else:
                        # Se è un numpy array, crea un dict
                        normalized_faces.append({
                            'face': item,
                            'facial_area': {'x': 0, 'y': 0, 'w': item.shape[1], 'h': item.shape[0]},
                            'confidence': 1.0
                        })
            elif isinstance(faces_data, tuple):
                # Vecchio formato tupla
                for item in faces_data:
                    if hasattr(item, 'shape'):
                        normalized_faces.append({
                            'face': item,
                            'facial_area': {'x': 0, 'y': 0, 'w': item.shape[1], 'h': item.shape[0]},
                            'confidence': 1.0
                        })
            
            for i, face_obj in enumerate(normalized_faces):
                try:
                    if not isinstance(face_obj, dict):
                        continue
                    
                    face_img = face_obj.get('face')
                    if face_img is None:
                        continue
                    
                    facial_area = face_obj.get('facial_area', {})
                    confidence = face_obj.get('confidence', 0)
                    
                    # Scala coordinate se immagine era ridimensionata
                    if scale != 1.0:
                        for key in ['x', 'y', 'w', 'h']:
                            if key in facial_area:
                                facial_area[key] = int(facial_area[key] / scale)
                    
                    # Validazioni
                    if confidence < min_confidence:
                        logger.debug(f"Volto {i+1} scartato: confidence {confidence:.2f} < {min_confidence}")
                        continue
                    
                    if (facial_area.get('w', 0) < min_face_size[0] or 
                        facial_area.get('h', 0) < min_face_size[1]):
                        logger.debug(f"Volto {i+1} troppo piccolo")
                        continue
                    
                    if (facial_area.get('w', 0) > max_face_size[0] or 
                        facial_area.get('h', 0) > max_face_size[1]):
                        logger.debug(f"Volto {i+1} troppo grande")
                        continue
                    
                    # Analisi qualità (blur detection)
                    face_region = image[
                        facial_area['y']:facial_area['y']+facial_area['h'],
                        facial_area['x']:facial_area['x']+facial_area['w']
                    ]
                    
                    if face_region.size > 0:
                        gray = cv2.cvtColor(face_region, cv2.COLOR_BGR2GRAY)
                        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
                        
                        blur_threshold = validation_config.get("blur_threshold", 100)
                        if blur_score < blur_threshold:
                            logger.debug(f"Volto {i+1} troppo sfocato: {blur_score:.1f}")
                            continue
                    
                    # Salva volto rilevato per debug
                    if self.save_debug_faces:
                        debug_filename = f"detected_face_{i+1}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
                        debug_path = os.path.join(self.debug_faces_dir, debug_filename)
                        
                        # Converti in uint8 se necessario
                        if face_img.dtype != np.uint8:
                            if face_img.max() <= 1.0:
                                face_to_save = (face_img * 255).astype(np.uint8)
                            else:
                                face_to_save = face_img.astype(np.uint8)
                        else:
                            face_to_save = face_img
                        
                        cv2.imwrite(debug_path, face_to_save)
                        logger.info(f"📸 Volto rilevato salvato: {debug_filename}")
                        
                        # Verifica che l'immagine non sia nera
                        if np.mean(face_to_save) < 5:
                            logger.error(f"⚠️ ATTENZIONE: Volto rilevato {i+1} sembra essere nero/vuoto!")
                    
                    # Genera embeddings  
                    logger.info(f"🚀 Generando embeddings per volto {i+1}...")
                    
                    # 🚨 CRITICAL FIX: Use extracted face image with maximum quality
                    # Salva temporaneamente il volto estratto con qualità massima
                    import tempfile
                    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
                        # Converti face_img da [0,1] a [0,255] se necessario
                        if face_img.max() <= 1.0:
                            face_to_process = (face_img * 255).astype(np.uint8)
                        else:
                            face_to_process = face_img.astype(np.uint8)
                        
                        # DeepFace extract_faces restituisce RGB, ma cv2.imwrite si aspetta BGR
                        # Converti solo se l'immagine ha 3 canali
                        if len(face_to_process.shape) == 3 and face_to_process.shape[2] == 3:
                            # DeepFace extract_faces usa RGB, convertiamo a BGR per cv2
                            face_to_process = cv2.cvtColor(face_to_process, cv2.COLOR_RGB2BGR)
                        
                        # Salva con qualità massima (100% JPEG)
                        cv2.imwrite(tmp.name, face_to_process, [cv2.IMWRITE_JPEG_QUALITY, 100])
                        temp_face_path = tmp.name
                    
                    logger.error(f"🔥 USING EXTRACTED FACE for face {i+1}: {temp_face_path}")
                    logger.error(f"🔥 Face shape: {face_to_process.shape}, dtype: {face_to_process.dtype}")
                    
                    embedding = self._generate_embedding(temp_face_path, self.model_name)
                    
                    # Cleanup temp file
                    os.unlink(temp_face_path)
                    if embedding is None:
                        continue
                    
                    face_data = {
                        'index': len(faces_detected),
                        'bbox': facial_area,
                        'confidence': confidence,
                        'embedding': embedding,
                        'quality_score': facial_area['w'] * facial_area['h'],
                        'blur_score': blur_score if 'blur_score' in locals() else 0
                    }
                    
                    # Embedding secondario per doppia verifica
                    if self.config["models"].get("verification", {}).get("enable_double_check", False):
                        secondary_model = self.config["models"]["verification"]["secondary_model"]
                        secondary_embedding = self._generate_embedding(face_img, secondary_model)
                        if secondary_embedding is not None:
                            face_data['embedding_secondary'] = secondary_embedding
                    
                    faces_detected.append(face_data)
                    logger.info(f"✅ Volto {i+1} validato e processato")
                    
                except Exception as e:
                    logger.error(f"❌ Errore processamento volto {i+1}: {e}")
                    continue
            
            detect_time = (time.time() - detect_start) * 1000
            self.metrics.detection_time_ms = detect_time
            
            logger.info(f"📊 Rilevamento completato in {detect_time:.0f}ms")
            logger.info(f"   - Volti trovati: {len(faces_data)}")
            logger.info(f"   - Volti validati: {len(faces_detected)}")
            
            return faces_detected
            
        except Exception as e:
            logger.error(f"❌ Errore rilevamento volti: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []
    
    def match_faces(self, faces: List[Dict], students: List[Dict]) -> List[Dict]:
        """Match volti con studenti usando Facenet512 e verifica avanzata"""
        try:
            match_start = time.time()
            recognized = []
            already_recognized_students = set()  # Track already recognized student IDs
            
            logger.info(f"\n🎯 MATCHING VOLTI (Facenet512)")
            logger.info(f"   Volti: {len(faces)}")
            logger.info(f"   Studenti: {len(students)}")
            logger.info(f"   Soglia: {self.similarity_threshold}")
            
            distance_metric = self.config["models"]["recognizer"].get("distance_metric", "cosine")
            enable_double_check = self.config["models"].get("verification", {}).get("enable_double_check", False)
            min_margin = self.config["models"]["verification"].get("min_confidence_margin", 0.05)
            
            for face_idx, face in enumerate(faces):
                logger.info(f"\n{'='*50}")
                logger.info(f"MATCHING VOLTO {face_idx + 1}")
                
                face_embedding = np.array(face['embedding']).copy()  # Force copy
                matches = []
                
                # 🚨 CRITICAL DEBUG LOGGING
                logger.error(f"🔥 FACE_EMB: {face_embedding[:3]} norm={np.linalg.norm(face_embedding):.3f}")
                
                # Confronta con tutti gli studenti (esclusi quelli già riconosciuti)
                for student in students:
                    if 'embedding' not in student:
                        continue
                    
                    # 🚨 Skip students already recognized
                    if student['id'] in already_recognized_students:
                        logger.debug(f"⏭️ Skip {student['name']} - già riconosciuto")
                        continue
                    
                    try:
                        student_embedding = np.array(student['embedding']).copy()  # Force copy
                        
                        # 🚨 CRITICAL DEBUG LOGGING
                        logger.error(f"🔥 STUD_EMB {student['name']}: {student_embedding[:3]} norm={np.linalg.norm(student_embedding):.3f}")
                        
                        # Calcola distanza/similarità
                        if distance_metric == "cosine":
                            # Normalize embeddings for cosine similarity
                            face_norm = face_embedding / np.linalg.norm(face_embedding)
                            student_norm = student_embedding / np.linalg.norm(student_embedding)
                            similarity = np.dot(face_norm, student_norm)
                            distance = 1 - similarity
                            
                            # 🚨 CRITICAL DEBUG LOGGING
                            logger.error(f"🔥 SIMILARITY {student['name']}: {similarity:.6f}")
                        elif distance_metric == "euclidean":
                            distance = np.linalg.norm(face_embedding - student_embedding)
                            similarity = 1 / (1 + distance)
                        else:
                            # Euclidean L2
                            distance = np.linalg.norm(face_embedding - student_embedding)
                            similarity = 1 / (1 + distance)
                        
                        match_data = {
                            'student': student,
                            'similarity': similarity,
                            'distance': distance
                        }
                        
                        # Additional validation checks
                        if np.allclose(face_embedding, student_embedding, atol=1e-6):
                            logger.error(f"🚨 IDENTICAL EMBEDDINGS DETECTED for {student['name']}!")
                            
                        if np.linalg.norm(face_embedding) < 0.1:
                            logger.error(f"🚨 ZERO/NEAR-ZERO FACE EMBEDDING!")
                            
                        if np.linalg.norm(student_embedding) < 0.1:
                            logger.error(f"🚨 ZERO/NEAR-ZERO STUDENT EMBEDDING for {student['name']}!")
                        
                        # Doppia verifica se abilitata
                        if enable_double_check and 'embedding_secondary' in face:
                            student_embedding_sec = np.array(student.get('embedding_secondary', []))
                            if student_embedding_sec.size > 0:
                                face_embedding_sec = face['embedding_secondary']
                                # Gli embeddings secondari sono già normalizzati
                                similarity_sec = np.dot(face_embedding_sec, student_embedding_sec)
                                match_data['similarity_secondary'] = similarity_sec
                                # Media ponderata
                                match_data['combined_similarity'] = (
                                    0.7 * similarity + 0.3 * similarity_sec
                                )
                                logger.debug(f"    Secondary sim: {similarity_sec:.6f}, Combined: {match_data['combined_similarity']:.6f}")
                            else:
                                match_data['combined_similarity'] = similarity
                        else:
                            match_data['combined_similarity'] = similarity
                        
                        matches.append(match_data)
                        
                    except Exception as e:
                        logger.debug(f"Errore confronto con {student.get('name')}: {e}")
                        continue
                
                # Ordina per similarità combinata
                matches.sort(key=lambda x: x['combined_similarity'], reverse=True)
                
                # Log top matches
                logger.info(f"\n📊 TOP 5 MATCHES:")
                for i, match in enumerate(matches[:5]):
                    student = match['student']
                    sim = match['combined_similarity']
                    dist = match['distance']
                    logger.info(
                        f"   {i+1}. {student['name']} {student.get('surname', '')} - "
                        f"Similarity: {sim:.3f} - Distance: {dist:.3f}"
                    )
                    
                # Salva dettagli match per debug
                if self.save_debug_faces:
                    match_details_file = f"match_details_face{face_idx+1}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
                    match_details_path = os.path.join(self.debug_faces_dir, match_details_file)
                    with open(match_details_path, 'w') as f:
                        f.write(f"DETTAGLI MATCH VOLTO {face_idx + 1}\n")
                        f.write(f"{'='*50}\n\n")
                        f.write(f"Threshold configurato: {self.similarity_threshold}\n")
                        f.write(f"Metrica distanza: {distance_metric}\n\n")
                        
                        for i, match in enumerate(matches[:10]):
                            student = match['student']
                            f.write(f"{i+1}. {student['name']} {student.get('surname', '')}\n")
                            f.write(f"   - Similarity: {match['combined_similarity']:.6f}\n")
                            f.write(f"   - Distance: {match['distance']:.6f}\n")
                            f.write(f"   - Supera threshold: {'SI' if match['combined_similarity'] > self.similarity_threshold else 'NO'}\n")
                            if 'similarity_secondary' in match:
                                f.write(f"   - Secondary similarity: {match['similarity_secondary']:.6f}\n")
                            f.write("\n")
                
                # Salva immagine di confronto per debug
                if self.save_debug_faces and matches:
                    comparison_filename = f"comparison_face{face_idx+1}_vs_top_matches_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
                    comparison_path = os.path.join(self.debug_faces_dir, comparison_filename)
                    
                    # Crea immagine di confronto
                    self._create_comparison_image(face, matches[:3], comparison_path)
                    logger.info(f"📸 Confronto salvato: {comparison_filename}")
                
                # Verifica best match
                if matches and matches[0]['combined_similarity'] > self.similarity_threshold:
                    best_match = matches[0]
                    
                    # Verifica margine con secondo miglior match
                    if len(matches) > 1:
                        margin = best_match['combined_similarity'] - matches[1]['combined_similarity']
                        if margin < min_margin:
                            logger.warning(
                                f"⚠️ Match incerto - margine {margin:.3f} < {min_margin}"
                            )
                            continue
                    
                    # Match confermato
                    student = best_match['student']
                    student_id = student['id']
                    
                    # 🚨 Check if student already recognized
                    if student_id in already_recognized_students:
                        logger.warning(f"⚠️ STUDENTE GIÀ RICONOSCIUTO: {student['name']} {student.get('surname', '')} - Skip")
                        continue
                    
                    # Add to recognized students set
                    already_recognized_students.add(student_id)
                    
                    logger.info(f"\n✅ RICONOSCIUTO: {student['name']} {student.get('surname', '')}")
                    logger.info(f"   Confidence: {best_match['combined_similarity']:.3f}")
                    logger.info(f"   🔒 Studente marcato come riconosciuto (ID: {student_id})")
                    
                    recognized.append({
                        'userId': student_id,
                        'name': student['name'],
                        'surname': student.get('surname', ''),
                        'confidence': float(best_match['combined_similarity']),
                        'faceIndex': face['index'],
                        'embedding_cached': student.get('embedding_cached', False)
                    })
                else:
                    if matches:
                        logger.info(
                            f"\n❌ NON RICONOSCIUTO - "
                            f"Best: {matches[0]['combined_similarity']:.3f} < {self.similarity_threshold}"
                        )
                    else:
                        logger.info(f"\n❌ NESSUN MATCH")
            
            match_time = (time.time() - match_start) * 1000
            self.metrics.recognition_time_ms = match_time
            self.metrics.faces_processed = len(faces)
            
            logger.info(f"\n{'='*50}")
            logger.info(f"MATCHING COMPLETATO in {match_time:.0f}ms")
            logger.info(f"Riconosciuti: {len(recognized)}/{len(faces)}")
            
            return recognized
            
        except Exception as e:
            logger.error(f"❌ Errore matching: {e}")
            return []
    
    def generate_report_image(self, image: np.ndarray, faces: List[Dict], 
                            recognized: List[Dict]) -> str:
        """Genera report immagine con annotazioni (legacy support)"""
        try:
            report_img = image.copy()
            height, width = report_img.shape[:2]
            
            # Scala font in base a dimensione immagine
            font_scale = max(0.5, min(1.5, width / 1000))
            thickness = max(1, int(width / 500))
            
            # Header con statistiche
            header_height = int(50 * font_scale)
            overlay = report_img.copy()
            cv2.rectangle(overlay, (0, 0), (width, header_height), (0, 0, 0), -1)
            report_img = cv2.addWeighted(report_img, 0.7, overlay, 0.3, 0)
            
            stats_text = (
                f"Face Detection v4.0 | "
                f"Detector: {self.detector_backend} | "
                f"Model: {self.model_name} | "
                f"Faces: {len(faces)} | "
                f"Recognized: {len(recognized)}"
            )
            cv2.putText(report_img, stats_text, (10, int(30 * font_scale)),
                       cv2.FONT_HERSHEY_SIMPLEX, font_scale * 0.6, 
                       (255, 255, 255), thickness)
            
            # Mappa riconoscimenti
            recognized_map = {r['faceIndex']: r for r in recognized}
            
            # Annota volti
            for face in faces:
                bbox = face['bbox']
                x, y, w, h = bbox['x'], bbox['y'], bbox['w'], bbox['h']
                
                # Assicura che bbox sia dentro i limiti
                x = max(0, min(x, width - 1))
                y = max(0, min(y, height - 1))
                w = min(w, width - x)
                h = min(h, height - y)
                
                if face['index'] in recognized_map:
                    # Verde per riconosciuti
                    color = (0, 255, 0)
                    line_thickness = thickness + 1
                    
                    rec = recognized_map[face['index']]
                    label = f"{rec['name']} {rec['surname']}"
                    confidence = f"{rec['confidence']:.1%}"
                    cached = "📦" if rec.get('embedding_cached', False) else "🔄"
                    
                    # Background per testo
                    label_height = int(60 * font_scale)
                    cv2.rectangle(report_img, 
                                (x, y - label_height), 
                                (x + int(250 * font_scale), y), 
                                (0, 200, 0), -1)
                    
                    cv2.putText(report_img, label, 
                              (x + 5, y - int(35 * font_scale)),
                              cv2.FONT_HERSHEY_SIMPLEX, font_scale * 0.7, 
                              (255, 255, 255), thickness)
                    
                    cv2.putText(report_img, f"{confidence} {cached}", 
                              (x + 5, y - int(10 * font_scale)),
                              cv2.FONT_HERSHEY_SIMPLEX, font_scale * 0.6, 
                              (255, 255, 255), thickness)
                else:
                    # Rosso per non riconosciuti
                    color = (0, 0, 255)
                    line_thickness = thickness
                    
                    confidence = face.get('confidence', 0)
                    blur = face.get('blur_score', 0)
                    
                    label_text = f"Unknown | Conf: {confidence:.1%}"
                    if blur > 0:
                        label_text += f" | Blur: {blur:.0f}"
                    
                    cv2.putText(report_img, label_text,
                              (x + 5, y - 10),
                              cv2.FONT_HERSHEY_SIMPLEX, font_scale * 0.5,
                              color, thickness)
                
                # Disegna rettangolo
                cv2.rectangle(report_img, (x, y), (x + w, y + h), 
                            color, line_thickness)
                
                # Numero volto
                cv2.putText(report_img, f"#{face['index'] + 1}", 
                          (x + w - int(40 * font_scale), y + int(25 * font_scale)),
                          cv2.FONT_HERSHEY_SIMPLEX, font_scale * 0.6, 
                          color, thickness)
            
            # Footer con performance metrics
            if self.config["output"].get("include_performance_metrics", True):
                footer_height = int(30 * font_scale)
                overlay = report_img.copy()
                cv2.rectangle(overlay, (0, height - footer_height), 
                            (width, height), (0, 0, 0), -1)
                report_img = cv2.addWeighted(report_img, 0.7, overlay, 0.3, 0)
                
                perf_text = (
                    f"Detection: {self.metrics.detection_time_ms:.0f}ms | "
                    f"Recognition: {self.metrics.recognition_time_ms:.0f}ms | "
                    f"Cache Hit: {self.embedding_cache.get_hit_rate():.0%}"
                )
                cv2.putText(report_img, perf_text, 
                          (10, height - int(10 * font_scale)),
                          cv2.FONT_HERSHEY_SIMPLEX, font_scale * 0.5, 
                          (255, 255, 255), thickness)
            
            # Salva report
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            
            # Se debug disabilitato, usa temp
            if self.config["output"]["save_debug_images"]:
                reports_dir = os.path.join(self.project_root, "temp", "reports")
            else:
                reports_dir = os.path.join(self.project_root, "temp")
            
            os.makedirs(reports_dir, exist_ok=True)
            
            # Comprimi se necessario
            quality = self.config["output"].get("report_image_quality", 85)
            max_size = self.config["output"].get("report_image_max_size", [1920, 1080])
            
            if width > max_size[0] or height > max_size[1]:
                scale = min(max_size[0] / width, max_size[1] / height)
                new_size = (int(width * scale), int(height * scale))
                report_img = cv2.resize(report_img, new_size)
            
            report_path = os.path.join(reports_dir, f"report_v4_{timestamp}.jpg")
            cv2.imwrite(report_path, report_img, [cv2.IMWRITE_JPEG_QUALITY, quality])
            
            logger.info(f"📊 Report salvato: {report_path}")
            return report_path
            
        except Exception as e:
            logger.error(f"❌ Errore generazione report: {e}")
            return ""
    
    def process_image(self) -> str:
        """Processa immagine completa (legacy interface)"""
        try:
            # Tracking tempo totale
            process_start = time.time()
            
            # 1. Carica immagine
            if not os.path.exists(self.image_path):
                raise Exception(f"Immagine non trovata: {self.image_path}")
            
            image = cv2.imread(self.image_path)
            if image is None:
                raise Exception("Errore caricamento immagine")
            
            logger.info(f"✅ Immagine caricata: {image.shape}")
            
            # 2. Carica studenti
            students = self.load_students()
            
            # 3. Rileva volti
            faces = self.detect_faces(self.image_path)
            
            # 4. Match volti
            recognized = []
            if len(faces) > 0 and len(students) > 0:
                recognized = self.match_faces(faces, students)
            
            # 5. Genera report
            report_path = ""
            if self.config["output"].get("save_debug_images", True) or True:  # Sempre per legacy
                report_path = self.generate_report_image(image, faces, recognized)
            
            # Calcola metriche finali
            total_time = (time.time() - process_start) * 1000
            self.metrics.total_time_ms = total_time
            self.metrics.cache_hit_rate = self.embedding_cache.get_hit_rate()
            
            # Prepara confidence distribution
            confidence_dist = {
                "high_confidence": len([r for r in recognized if r['confidence'] > 0.8]),
                "medium_confidence": len([r for r in recognized if 0.4 <= r['confidence'] <= 0.8]),
                "low_confidence": len([r for r in recognized if r['confidence'] < 0.4])
            }
            
            # Calcola studenti assenti
            recognized_ids = {r['userId'] for r in recognized}
            absent_students = [
                {
                    'userId': student['id'],
                    'name': student['name'],
                    'surname': student.get('surname', ''),
                    'reason': 'not_detected'
                }
                for student in students 
                if student['id'] not in recognized_ids
            ]
            
            # Risultato strutturato
            result = {
                "timestamp": datetime.now().isoformat(),
                "image_file": os.path.basename(self.image_path),
                "detected_faces": len(faces),
                "recognized_students": recognized,
                "absent_students": absent_students,
                "report_image": report_path,
                "attendance_stats": {
                    "total_students": len(students),
                    "present_count": len(recognized),
                    "absent_count": len(absent_students),
                    "attendance_rate": (len(recognized) / len(students) * 100) if students else 0
                },
                "processing_info": {
                    "processing_time": total_time / 1000,  # secondi per legacy
                    "model_used": self.model_name,
                    "detector_used": self.detector_backend,
                    "threshold": self.similarity_threshold,
                    "version": "4.0-optimized"
                },
                "performance_metrics": {
                    "detection_time_ms": self.metrics.detection_time_ms,
                    "recognition_time_ms": self.metrics.recognition_time_ms,
                    "total_time_ms": total_time,
                    "cache_hit_rate": self.metrics.cache_hit_rate,
                    "faces_processed": self.metrics.faces_processed
                },
                "confidence_distribution": confidence_dist,
                "quality_metrics": {
                    "faces_with_high_confidence": len([f for f in faces if f.get('confidence', 0) > 0.95]),
                    "average_match_confidence": np.mean([r['confidence'] for r in recognized]) if recognized else 0,
                    "min_match_confidence": min([r['confidence'] for r in recognized]) if recognized else 0,
                    "max_match_confidence": max([r['confidence'] for r in recognized]) if recognized else 0
                },
                "status": "success"
            }
            
            logger.info(f"\n{'='*60}")
            logger.info(f"✅ ELABORAZIONE COMPLETATA")
            logger.info(f"{'='*60}")
            logger.info(f"⏱️  Tempo totale: {total_time:.0f}ms")
            logger.info(f"👥 Studenti: {len(students)}")
            logger.info(f"🔍 Volti rilevati: {len(faces)}")
            logger.info(f"✅ Riconosciuti: {len(recognized)}")
            logger.info(f"📊 Accuratezza: {(len(recognized)/len(faces)*100) if faces else 0:.1f}%")
            logger.info(f"💾 Cache hit rate: {self.metrics.cache_hit_rate:.1%}")
            
            return json.dumps(result, indent=2)
            
        except Exception as e:
            logger.error(f"❌ Errore elaborazione: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            
            # Anche in caso di errore, restituisci JSON strutturato
            return json.dumps({
                "error": str(e),
                "timestamp": datetime.now().isoformat(),
                "processing_time": (time.time() - self.start_time),
                "detected_faces": 0,
                "recognized_students": [],
                "status": "error",
                "version": "4.0-optimized"
            }, indent=2)
    
    def _create_comparison_image(self, face_data: Dict, top_matches: List[Dict], output_path: str):
        """Crea un'immagine di confronto per debug"""
        try:
            # Dimensioni per ogni volto
            face_size = 150
            padding = 10
            font = cv2.FONT_HERSHEY_SIMPLEX
            
            # Calcola dimensioni immagine totale
            num_matches = min(len(top_matches), 3)
            width = (num_matches + 1) * (face_size + padding) + padding
            height = face_size + 60  # Spazio per testo
            
            # Crea immagine bianca
            comparison_img = np.ones((height, width, 3), dtype=np.uint8) * 255
            
            # Aggiungi volto rilevato
            if 'bbox' in face_data:
                # Estrai volto dall'immagine originale
                image = cv2.imread(self.image_path)
                bbox = face_data['bbox']
                face_region = image[bbox['y']:bbox['y']+bbox['h'], bbox['x']:bbox['x']+bbox['w']]
                face_resized = cv2.resize(face_region, (face_size, face_size))
            else:
                # Usa placeholder
                face_resized = np.ones((face_size, face_size, 3), dtype=np.uint8) * 128
            
            # Posiziona volto rilevato
            x_pos = padding
            comparison_img[10:10+face_size, x_pos:x_pos+face_size] = face_resized
            cv2.putText(comparison_img, "Detected", (x_pos, height-10), font, 0.5, (0, 0, 0), 1)
            
            # Aggiungi volti degli studenti
            for i, match in enumerate(top_matches):
                x_pos = (i + 1) * (face_size + padding) + padding
                student = match['student']
                
                # Carica foto studente
                student_path = os.path.join(self.debug_faces_dir, 
                    f"student_{student['id']}_{student['name']}_{student.get('surname', '')}.jpg")
                
                if os.path.exists(student_path):
                    student_face = cv2.imread(student_path)
                    student_face = cv2.resize(student_face, (face_size, face_size))
                else:
                    # Usa placeholder
                    student_face = np.ones((face_size, face_size, 3), dtype=np.uint8) * 200
                
                comparison_img[10:10+face_size, x_pos:x_pos+face_size] = student_face
                
                # Aggiungi testo
                text = f"{student['name']} {student.get('surname', '')}"
                sim = match['combined_similarity']
                cv2.putText(comparison_img, text[:15], (x_pos, height-25), font, 0.4, (0, 0, 0), 1)
                cv2.putText(comparison_img, f"Sim: {sim:.3f}", (x_pos, height-10), font, 0.4, (0, 128, 0), 1)
            
            # Salva immagine
            cv2.imwrite(output_path, comparison_img)
            
        except Exception as e:
            logger.error(f"Errore creazione immagine confronto: {e}")

def main():
    """Entry point con supporto CLI"""
    parser = argparse.ArgumentParser(
        description='Face Detection System v4.0 - Optimized with RetinaFace + Facenet512'
    )
    parser.add_argument('image_path', help='Path immagine da analizzare')
    parser.add_argument('--output', help='File output JSON')
    parser.add_argument('--students', help='File JSON con dati studenti')
    parser.add_argument('--config', help='File configurazione custom')
    parser.add_argument('--debug', action='store_true', help='Modalità debug')
    parser.add_argument('--threshold', type=float, help='Override threshold similarità')
    parser.add_argument('--detector', choices=['retinaface', 'mtcnn', 'opencv'], 
                       help='Override detector backend')
    parser.add_argument('--no-cache', action='store_true', help='Disabilita cache embeddings')
    
    args = parser.parse_args()
    
    if args.debug:
        logger.setLevel(logging.DEBUG)
    
    print("=" * 70)
    print("FACE DETECTION SYSTEM v4.0 - PRODUCTION OPTIMIZED")
    print("Models: RetinaFace + Facenet512")
    print("=" * 70)
    
    try:
        # Crea sistema
        detector = FaceDetectionSystem(
            args.image_path, 
            args.students,
            args.config
        )
        
        # Override parametri se specificati
        if args.threshold:
            detector.similarity_threshold = args.threshold
            logger.info(f"🎯 Override threshold: {args.threshold}")
        
        if args.detector:
            detector.detector_backend = args.detector
            logger.info(f"🎯 Override detector: {args.detector}")
        
        if args.no_cache:
            detector.enable_caching = False
            logger.info("🎯 Cache disabilitata")
        
        # Processa
        result = detector.process_image()
        
        # Output
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(result)
            logger.info(f"✅ Output salvato: {args.output}")
        
        print(result)
        
    except Exception as e:
        logger.error(f"❌ Errore critico: {str(e)}")
        error_result = json.dumps({
            "error": str(e), 
            "status": "critical_error",
            "version": "4.0"
        })
        print(error_result)
        sys.exit(1)

if __name__ == "__main__":
    main()