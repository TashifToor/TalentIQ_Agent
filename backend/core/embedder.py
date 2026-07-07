import os
from typing import List
from sentence_transformers import SentenceTransformer

# Module-level cache — the transformer model is loaded from disk exactly
# once per process, regardless of how many times Langchain_Embedding_Wrapper()
# gets instantiated (e.g. one instance per /Rating/screen request). Loading
# these weights repeatedly was the single biggest latency cost in the
# screening pipeline — this fixes that at the source, no cache infra needed.
_MODEL_CACHE: dict[str, SentenceTransformer] = {}


def _get_cached_model(model_name: str) -> SentenceTransformer:
    if model_name not in _MODEL_CACHE:
        print(f"[Embedding] Loading Embedding Model ({model_name}) — first load, caching in memory...")
        _MODEL_CACHE[model_name] = SentenceTransformer(model_name)
    return _MODEL_CACHE[model_name]


class Langchain_Embedding_Wrapper:
    """Faiss ko embedding ke sath compatible banane ke liye custom embed wrapper"""
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model = _get_cached_model(model_name)

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