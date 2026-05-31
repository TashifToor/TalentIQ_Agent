import os
from typing import List
from sentence_transformers import SentenceTransformer

class Langchain_Embedding_Wrapper:
    """Faiss ko embedding ke sath compatible banane ke liye custom embed wrapper"""
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        print(f"[Embedding] Loading Embedding Model ({model_name})....")
        self.model = SentenceTransformer(model_name)
    
    # LangChain strict naming standards match kar di: single 'd' aur end mein 'documents' (plural)
    def embed_documents(self, texts: List[str]) -> list[list[float]]:
        embeddings = self.model.encode(texts, show_progress_bar=True)
        return [e.tolist() for e in embeddings]
    
    def embed_query(self, text: str) -> List[float]:
        # query standard string accepts karta hai
        embedding = self.model.encode(text, show_progress_bar=False)
        return embedding.tolist()
    
    def __call__(self, text: List[str]) -> list[float]:
        return self.embed_query(text)