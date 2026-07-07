# core/faiss.py
import os
from langchain_community.vectorstores import FAISS
from core.embedder import Langchain_Embedding_Wrapper

# Module-level cache for the on-disk FAISS index — avoids re-reading the
# index files from disk on every /Rating/screen request. Invalidated
# automatically whenever the index file's mtime changes (i.e. a new CV
# upload rebuilt it), so it never serves stale results.
_INDEX_CACHE: dict = {"index": None, "mtime": None, "path": None}

class VectorStore:
    """Managing the faiss index storage and retrieval"""
    def __init__(self, persist_directory: str = None):
        #  Dynamic Absolute Path Setup: Backend root directory se data folder tak ka path
        if persist_directory is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # core se bahar backend root tak
            self.persist_directory = os.path.join(base_dir, "data", "faiss_index")
        else:
            self.persist_directory = persist_directory
            
        print(f"[FAISS INFO] Target path set to: {self.persist_directory}")
        self.embedding_wrapper = Langchain_Embedding_Wrapper() 
        self.faiss_index = None
        
    def create_and_save_store(self, chunks):
        print(f"Creating Faiss index from Chunks.....")
        os.makedirs(self.persist_directory, exist_ok=True)
        
        self.faiss_index = FAISS.from_documents(chunks, self.embedding_wrapper)
        self.faiss_index.save_local(self.persist_directory)
        print(f"faiss index successfully stored at ({self.persist_directory})")

        # New upload invalidates the cache immediately.
        index_file_path = os.path.join(self.persist_directory, "index.faiss")
        _INDEX_CACHE["index"] = self.faiss_index
        _INDEX_CACHE["mtime"] = os.path.getmtime(index_file_path) if os.path.exists(index_file_path) else None
        _INDEX_CACHE["path"] = self.persist_directory
        return self.faiss_index

    def create_in_memory(self, chunks):
        """Bulk screening ke liye — disk pe save nahi karta, sirf memory mein FAISS banata hai."""
        print(f"[FAISS] Creating in-memory index (no disk IO)...")
        self.faiss_index = FAISS.from_documents(chunks, self.embedding_wrapper)
        return self.faiss_index
    
    def load_store(self):
        """Production mai database se direct load krne ke liye — disk read
        sirf tab hoti hai jab index file change ho chuki ho (naya upload),
        warna cached in-memory index turant return hota hai."""
        index_file_path = os.path.join(self.persist_directory, "index.faiss")

        if not os.path.exists(index_file_path):
            print(f"NO faiss index existing found at: {index_file_path}")
            return None

        current_mtime = os.path.getmtime(index_file_path)
        cache_is_fresh = (
            _INDEX_CACHE["index"] is not None
            and _INDEX_CACHE["path"] == self.persist_directory
            and _INDEX_CACHE["mtime"] == current_mtime
        )

        if cache_is_fresh:
            print(f"[FAISS] Serving cached in-memory index (no disk re-read)")
            self.faiss_index = _INDEX_CACHE["index"]
            return self.faiss_index

        print(f"Loaded existing FAISS store from drive")
        self.faiss_index = FAISS.load_local(
            self.persist_directory,
            self.embedding_wrapper,
            allow_dangerous_deserialization=True
        )
        _INDEX_CACHE["index"] = self.faiss_index
        _INDEX_CACHE["mtime"] = current_mtime
        _INDEX_CACHE["path"] = self.persist_directory
        print(f"Faiss Store Loaded Successfully ")
        return self.faiss_index