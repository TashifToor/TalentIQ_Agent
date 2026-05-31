from core.faiss import VectorStore
import json
from core.llm import llm
from core.state import ScreeningState


#Agent Engine Core
class TalentIQAgent:
    def __init__(self):
        self.vector_store_manager = VectorStore()
        self.faiss_db=self.vector_store_manager.load_store()
        
        if self.faiss_db:
            self.retriever=self.faiss_db.as_retriever(search_kwargs={"k":4}) 
        else:
            self.retriever=None
            print(f"FAISS DB not found. Please create the vector store before using the agent.")
        
        
    def _analyze_cv_node(self,state:ScreeningState)->ScreeningState:
        print(f"Executing Multi-Modal CV Analysis Node...")
        jd=state["job_description"]  
        
        if not self.retriever:
            return {**state,"screening_analysis":"No FAISS DB found. Cannot retrieve CV context."}
        docs=self.retriever.invoke(jd)
        cv_context="\n\n".join([doc.page_content for doc in docs])
        
        prompt=f"""You are an elite AI Technical Recruiter. Conduct a multi-step reasoning analysis of the candidate's CV context against the Job Description (JD).
        
        Step 1: Evaluate core technical stack alignment and proficiency level.
        Step 2: Analyze project complexity, business impact, and execution capability.
        Step 3: Identify absolute strengths versus hidden skill gaps.
        
        Job Description: {jd}
        Candidate CV Context: {cv_context}
        
        Provide your deep, unfiltered analytical screening notes:
        """
        response=llm.invoke(prompt)
        return {**state,"retrieved_cv_context":cv_context,"screening_analysis":response.content}
    
    def _rank_candidate(self,state: ScreeningState)->ScreeningState:
        print(f"Executing Candidate Ranking Node........")
        jd=state["job_description"]
        analysis=state["screening_analysis"]
        
        prompt = f"""
        Based on the provided Job Description and the Deep Screening Analysis, rank the candidate.
        You MUST respond strictly in the following JSON format. Do not include any markdown wrappers like ```json or backticks.
        
        Expected JSON Structure:
        {{
            "candidate_score": <an integer between 0 and 100 based on JD fitment>,
            "matched_skills": [<list of matching technical skills found as strings>],
            "missing_skills": [<list of missing core skills required by JD as strings>],
            "final_verdict": "<either 'Highly Shortlisted', 'Good Fit for Interview', or 'Rejected'>",
            "is_shortlisted": <true if score >= 75 and verdict is not Rejected, otherwise false>,
            "has_min_experience": <true if the candidate meets the core experience requirements mentioned in JD, otherwise false>,
            "trigger_interview": <true if the candidate is an excellent fit and interview should be triggered immediately, otherwise false>
        }}
        
        Job Description: {jd}
        Screening Analysis: {analysis}
        """
        response=llm.invoke(prompt)
        
        try:
            clean_response=response.content.strip()
            if clean_response.startswith("```"):
                clean_response=clean_response.replace("```json","").replace("```","").strip()
            metrics=json.loads(clean_response)
        except Exception as e:
            print(f"error parsing json response:{e}")
            metrics = {
                "candidate_score": 50, "matched_skills": [], "missing_skills": [], "final_verdict": "Error",
                "is_shortlisted": False, "has_min_experience": False, "trigger_interview": False
            }
        return {**state,
                "candidate_score":metrics.get("candidate_score",0),
                "matched_skills":metrics.get("matched_skills",[]),
                "missing_skills":metrics.get("missing_skills",[]),
                "final_verdict":metrics.get("final_verdict","Rejected"),
                "is_shortlisted":metrics.get("is_shortlisted",False),
                "has_min_experience":metrics.get("has_min_experience",False),
                "trigger_interview":metrics.get("trigger_interview",False)
                }