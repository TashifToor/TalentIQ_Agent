import os
import numpy as np
from typing import List, TypedDict
from dotenv import load_dotenv

from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from langchain_community.vectorstores import FAISS
from langchain_groq import ChatGroq
from langchain_core.documents import Document
from langgraph.graph import StateGraph, END

load_dotenv()

# ── LLM ─────────────────────────────────────────────────────────────
llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0.2,
    api_key=os.getenv("GROQ_API_KEY")
)

# ── Embedding ────────────────────────────────────────────────────────
class Embedding:
    __model = None

    def __init__(self, model_name="all-MiniLM-L6-v2"):
        self.model_name = model_name
        if Embedding.__model is None:
            print("[HR Pipeline] Loading Embedding Model...")
            Embedding.__model = SentenceTransformer(self.model_name)
        self.model = Embedding.__model


class LangChainEmbeddingWrapper:
    def __init__(self, embedding_manager_instance):
        self.manager = embedding_manager_instance

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        embeddings = self.manager.model.encode(texts, show_progress_bar=False)
        return [e.tolist() for e in embeddings]

    def embed_query(self, text: str) -> List[float]:
        return self.manager.model.encode(text, show_progress_bar=False).tolist()

    def __call__(self, text: str) -> List[float]:
        return self.embed_query(text)


# ── Vector Store ─────────────────────────────────────────────────────
class VectorStore:
    def __init__(self, embedding_manager, persist_directory: str = "./data/hr_faiss_index"):
        self.persist_directory = persist_directory
        self.embedding_wrapper = LangChainEmbeddingWrapper(embedding_manager)
        self.faiss_index = None

    def create_and_save_store(self, chunks):
        print(f"[HR Pipeline] Creating FAISS index from {len(chunks)} chunks...")
        os.makedirs(self.persist_directory, exist_ok=True)
        self.faiss_index = FAISS.from_documents(chunks, self.embedding_wrapper)
        self.faiss_index.save_local(self.persist_directory)
        print(f"[HR Pipeline] FAISS saved at: {self.persist_directory}")
        return self.faiss_index

    def load_store(self):
        index_path = os.path.join(self.persist_directory, "index.faiss")
        if os.path.exists(index_path):
            self.faiss_index = FAISS.load_local(
                self.persist_directory,
                self.embedding_wrapper,
                allow_dangerous_deserialization=True
            )
            print("[HR Pipeline] FAISS index loaded successfully")
            return self.faiss_index
        return None


# ── Build retriever once at startup ──────────────────────────────────
def _build_retriever():
    embedding_manager = Embedding()
    db_manager = VectorStore(
        embedding_manager=embedding_manager,
        persist_directory="./data/hr_faiss_index"
    )

    # Try loading existing index first
    faiss_db = db_manager.load_store()

    if faiss_db is None:
        print("[HR Pipeline] No existing index — building from HR policy PDFs...")

        # Exact folder name from disk: "hr_poilices" (typo intentional — matches actual folder)
        hr_policies_path = "./data/hr_poilices"

        if not os.path.exists(hr_policies_path):
            print(f"[HR Pipeline] WARNING: Folder not found: {hr_policies_path}")
            return None

        pdf_files = [f for f in os.listdir(hr_policies_path) if f.endswith(".pdf")]
        if not pdf_files:
            print(f"[HR Pipeline] WARNING: No PDFs in {hr_policies_path}")
            return None

        print(f"[HR Pipeline] Found {len(pdf_files)} PDF(s)")

        loader = DirectoryLoader(
            hr_policies_path,
            glob="**/*.pdf",
            loader_cls=PyPDFLoader,
            show_progress=True
        )
        documents = loader.load()

        if not documents:
            print("[HR Pipeline] WARNING: Could not extract text from PDFs")
            return None

        print(f"[HR Pipeline] Loaded {len(documents)} document pages")

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=100,
            separators=["\n\n", "\n", ".", " "]
        )
        chunks = splitter.split_documents(documents)
        for i, chunk in enumerate(chunks):
            chunk.metadata["chunk_id"] = i

        print(f"[HR Pipeline] Created {len(chunks)} chunks")
        faiss_db = db_manager.create_and_save_store(chunks)

    return faiss_db.as_retriever(search_kwargs={"k": 4})


# ── Initialize ────────────────────────────────────────────────────────
print("[HR Pipeline] Initializing HR Policy RAG pipeline...")
_retriever = _build_retriever()

if _retriever:
    print("[HR Pipeline] Retriever ready")
else:
    print("[HR Pipeline] Retriever not available — LLM only mode")


# ── LangGraph Agent ───────────────────────────────────────────────────
class AgentState(TypedDict):
    question: str
    documents: List[Document]
    answer: str
    needs_retrieval: bool


def decide_retrieval(state: AgentState) -> AgentState:
    question = state["question"].lower()
    keywords = [
        "what", "how", "explain", "describe", "tell me", "why", "when", "who",
        "policy", "leave", "salary", "benefit", "hire", "onboard", "performance",
        "training", "discipline", "grievance", "diversity", "compensation",
        "probation", "notice", "resignation", "termination", "offboard",
        "interview", "background", "check", "review", "appraisal"
    ]
    needs = any(k in question for k in keywords)
    return {**state, "needs_retrieval": needs}


def retrieve_document(state: AgentState) -> AgentState:
    if _retriever is None:
        return {**state, "documents": []}
    try:
        docs = _retriever.invoke(state["question"])
        return {**state, "documents": docs}
    except Exception as e:
        print(f"[HR Pipeline] Retrieval error: {e}")
        return {**state, "documents": []}


def generate_answer(state: AgentState) -> AgentState:
    question  = state["question"]
    documents = state.get("documents", [])

    if documents:
        context = "\n\n".join([doc.page_content for doc in documents])
        prompt = f"""You are a professional HR Policy Assistant for TalentIQ.
Answer the employee's question based on the company policy documents provided below.
Be clear, professional, and concise. Use bullet points where helpful.
If the answer is not in the documents, say so honestly.

Company Policy Documents:
{context}

Employee Question: {question}

Answer:"""
    else:
        prompt = f"""You are a professional HR Policy Assistant for TalentIQ.
Answer this HR-related question professionally: {question}"""

    response = llm.invoke(prompt)
    return {**state, "answer": response.content}


def should_retrieve(state: AgentState) -> str:
    return "retrieve" if state["needs_retrieval"] else "generate"


# ── Build graph ───────────────────────────────────────────────────────
_workflow = StateGraph(AgentState)
_workflow.add_node("decide",   decide_retrieval)
_workflow.add_node("retrieve", retrieve_document)
_workflow.add_node("generate", generate_answer)
_workflow.set_entry_point("decide")
_workflow.add_conditional_edges("decide", should_retrieve, {
    "retrieve": "retrieve",
    "generate": "generate"
})
_workflow.add_edge("retrieve", "generate")
_workflow.add_edge("generate", END)

_app = _workflow.compile()
print("[HR Pipeline] LangGraph compiled successfully\n")


# ── Public function ───────────────────────────────────────────────────
def ask_question(question: str) -> dict:
    initial_state: AgentState = {
        "question":        question,
        "documents":       [],
        "answer":          "",
        "needs_retrieval": False,
    }
    return _app.invoke(initial_state)


# ── Direct test ───────────────────────────────────────────────────────
if __name__ == "__main__":
    q = "What is the employee leave policy?"
    print(f"\nTest Q: {q}")
    result = ask_question(q)
    print(f"Docs retrieved: {len(result['documents'])}")
    print(f"Answer:\n{result['answer']}")