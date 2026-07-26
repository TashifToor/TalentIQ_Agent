# TalentIQ v2 — Agentic Recruiment Screening Platform

TalentIQ is a next-generation, asynchronous AI recruiting platform designed to automate deep technical candidate screening. Moving away from legacy keyword-matching ATS, TalentIQ uses an advanced multi-modal agentic graph workflow powered by **LLaMA 3.3 (70B)** and **FAISS (Facebook AI Search System) Vector Storage** to read, analyze, and grade candidate CVs against complex Job Descriptions with absolute chain-of-thought through reasoning.

![Premium Tech Dark Mode Visual](https://img.shields.io/badge/Architecture-Agentic%20LangGraph-emerald?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-FastAPI%20%7C%20React%20%7C%20Docker-blue?style=for-the-badge)

---

##  Key Core Features

* **Agentic Graph Pipeline:** Built using **LangGraph** to process multi-step screening boundaries (Sequential `analyze_cv` ➡️ `rank_candidate` node).
* **On-The-Fly Dynamic Ingestion:** Hot-reloads and overwrites the local FAISS vector store on every single HTTP request—zero residual cache or cross-candidate data leak.
* **Deep LLaMA 3.3 Reasoning:** Leverages the 70B model to perform multi-step analysis on stack alignment, project complexity, and core execution capabilities.
* **Structured JSON Extraction:** Strict Pydantic parsing that automatically updates frontend metric widgets (Scores, Flag triggers, Missing Skill Gaps).
* **Secure Multi-Tenant SaaS Architecture:** Fully equipped with JWT-based route authentication and secure dependency-injected PostgreSQL session handling.

---

## 🏗️ Technical Architecture Flow

```text
[Frontend Requests] 
       │ (Jobs Descriptions + Dynamic CV Text)
       ▼
[FastAPI Router] ──▶ Clears Stale Cache ──▶ Generates Fresh FAISS Embeddings
       │
       ▼
[LangGraph Worksflow Orchestrator]
       │
       ├──► Node 1: '_analyze_cv_node' ──▶ Queries FAISS Store + Triggers LLaMA 3.3 Chain
       │                                  
       ├──► Node 2: '_rank_candidate'  ──▶ Computes Matrix Scores & Formats Structured JSON
       ▼
[Frontend Dashboard UI] ──▶ Renders Score, Matched Skills, Gaps, and Deep Markdown Analysis

🛠️ The Tech Stack

Backend: FastAPI (Python 3.12+), Uvicorn

Orchestration & AI: LangChain, LangGraph (StateGraph Workflow)

Vector Database: FAISS (Facebook AI Similarity Search)

Embeddings Model: sentence-transformers/all-MiniLM-L6-v2

LLM Provider: LLaMA 3.3 (70B Engine via Groq / Ollama API context)

Database & ORM: PostgreSQL / MySQL utilizing SQLAlchemy ORM

Frontend: React.js, Tailwind CSS (Custom Dark Minimalist Interface)

DevOps: Dockerized Architecture

🚀 Getting Started Locally
1. Clone the Repository
Bash
git clone [https://github.com/yourusername/TalentIQ.git](https://github.com/yourusername/TalentIQ.git)
cd TalentIQ/backend
2. Configure Environment Variables (.env)
Create a .env file inside the backend/ directory:

Code snippet
DATABASE_URL=postgresql://user:password@localhost:5432/talentiq
SECRET_KEY=your_super_secure_jwt_secret_key
GROQ_API_KEY=gsk_your_groq_api_key_here
3. Install Dependencies & Run
Bash
# Install required modules
pip install -r requirements.txt

# Launch FastAPI server via Uvicorn
uvicorn main:app --reload
The server will boot up at http://127.0.0.1:8000. You can access the automatic interactive API documentation at http://127.0.0.1:8000/docs.

🧪 Core API Endpoint Documentation
POST /Rating/screen
Triggers the full real-time agentic workflow for a specific candidate profiling.

Request Payload:

JSON
{
  "job_description": "Looking for a Backend Developer proficient in Python, Django, DRF, and Docker containerization.",
  "cv_text": "Candidate with 2 years of experience building scalable microservices using Python and Django REST Framework. Strong database optimization skills in PostgreSQL."
}
Successful Response Structure:

JSON
{
  "status": "success",
  "metrics": {
    "candidate_score": 85,
    "matched_skills": ["Python", "Django", "Django REST Framework (DRF)", "PostgreSQL"],
    "missing_skills": ["Docker"],
    "final_verdict": "Good Fit for Interview"
  },
  "flags": {
    "is_shortlisted": true,
    "has_min_experience": true,
    "trigger_interview": true
  },
  "deep_analysis": "### Step 1: Stack Alignment...\nCandidate has highly specific framework alignments with core technologies..."
}
🐳 Containerization & Deployment
To build and deploy the entire multi-tenant stack onto production seamlessly via Docker:

Bash
# Build containers
docker-compose up --build -d
## This Project is Under Construction
📄 License
Distributed under the MIT License. See LICENSE for more information.

Generated with ⚡ by Tashif — Dedicated to building automated infrastructure that runs on autopilot.
