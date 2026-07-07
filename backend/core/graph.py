# core/graph.py
from core.state import ScreeningState
from core.agent import TalentIQAgent
from langgraph.graph import StateGraph, START, END
from typing import List, Dict, Any, TypedDict

class TalentIQGraph:
    def __init__(self, user_id: int = None):
        # 1. Pehle agent initialize hoga taake nodes isay access kar sakein
        self.agent = TalentIQAgent(user_id=user_id)
        # 2. Baad mein graph build hoga
        self.app = self._build_graph()

    def _build_graph(self):
        workflow = StateGraph(ScreeningState)
        
        #  Ab dummy functions ki bajaye agent ke real logic wale nodes connect honge
        workflow.add_node("analyze_cv", self._analyze_cv_node)
        workflow.add_node("rank_candidate", self._rank_candidate)
    
        workflow.add_edge(START, "analyze_cv")
        workflow.add_edge("analyze_cv", "rank_candidate")
        workflow.add_edge("rank_candidate", END)
    
        return workflow.compile()
    
    def _analyze_cv_node(self, state: ScreeningState) -> Dict[str, Any]:
        print("[Graph Boundary] Redirecting to Agent's CV Analysis...")
        #  Yeh line agent ka original code chalaye gi
        return self.agent._analyze_cv_node(state)
    
    def _rank_candidate(self, state: ScreeningState) -> Dict[str, Any]:
        print("[Graph Boundary] Redirecting to Agent's Candidate Ranking...")
        # Yeh line agent ka ranking code aur LLaMA JSON parse chalaye gi
        return self.agent._rank_candidate(state)

    def run_screening(self, job_description: str) -> Dict[str, Any]:
        initial_state = {
            "job_description": job_description,
            "retrieved_cv_context": "",
            "screening_analysis": "",
            "candidate_score": 0,
            "matched_skills": [],
            "missing_skills": [],
            "final_verdict": "",
            "is_shortlisted": False,
            "trigger_interview": False,
            "has_minimum_qualifications": False,
            "has_relevant_experience": False    
        }
        return self.app.invoke(initial_state)

    def run_screening_with_index(self, job_description: str, faiss_index) -> Dict[str, Any]:
        """Bulk screening ke liye — prebuilt in-memory FAISS index inject karta hai, disk load skip."""
        self.agent.faiss_db = faiss_index
        self.agent.retriever = faiss_index.as_retriever(search_kwargs={"k": 4})
        return self.run_screening(job_description=job_description)