# TalentIQ - Agentic RAG CV Screening & Candidate Ranking Engine 🚀

TalentIQ is an enterprise-grade AI-powered recruitment platform designed to automate and optimize the talent acquisition process. Moving beyond simple keyword-matching RAG applications, TalentIQ leverages an advanced **Agentic RAG Architecture** with multi-step reasoning capabilities to analyze, screen, score, and rank candidate resumes against specific Job Descriptions (JDs) with maximum precision.

---

## 🧠 Core Architecture & Workflow

TalentIQ operates on a modular, multi-agent state system powered by **LangGraph** and **Llama-3.3-70b**. The intelligence pipeline is bifurcated into distinct execution phases:

1. **Document Ingestion & Chunking (`loader.py` & `chunker.py`):** Resumes are dynamically parsed from the directory using LangChain's Directory Loaders and processed via recursive character splitting with rigorous metadata overhead handling (`chunk_id`).
2. **Dense Vector Embeddings (`embedder.py`):** Text chunks are mapped using `all-MiniLM-L6-v2` SentenceTransformers wrapped into custom Python interfaces to interact seamlessly with **FAISS (Facebook AI Similarity Search)**.
3. **Agentic Reasoning & Graph Routing (`agent.py`):**
   * **Node 1 (`analyze_cv`):** Performs semantic search via FAISS and executes deep context-aware qualitative analysis checking technical depths, scope of projects, and absolute alignment.
   * **Node 2 (`rank_candidate`):** Consolidates reasoning diagnostics and enforces strict operational parameters to return a deterministic JSON response comprising a numerical score (0-100), matched/missing skills matrices, and an automated hiring verdict.

---

## 📂 Project Repository Structure

```text
backend/
│
├── core/
│   ├── __init__.py           # Marks the folder as a Python package
│   ├── loader.py             # PDF reading & raw text extraction logic
│   ├── chunker.py            # Recursive document parsing & chunk metadata allocation
│   ├── embedder.py           # Custom SentenceTransformer wrappers & local FAISS indexing
│   └── agent.py              # LangGraph orchestration, multi-step reasoning nodes, and LLM setup
│
├── data/
│   ├── pdf/                  # Repository drop-zone for candidate resumes
│   └── faiss_index/          # Local vectorized state storage (.faiss & .pkl maps)
│
├── .env                      # API Credentials (GROQ_API_KEY)
├── pipeline.py               # Local system integration testing runner script
└── main.py                   # FastAPI application initialization (In-Development)
