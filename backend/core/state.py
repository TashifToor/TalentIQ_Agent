# cors/state.py
from typing import List,TypedDict
class ScreeningState(TypedDict):
    #Input Fields
    job_description: str
    retrieved_cv_context: str
    #Analytics & Reasoning (Text)
    screening_analysis: str
    #Dashboard Metrics
    candidate_score: int
    matched_skills: List[str]
    missing_skills: List[str]
    final_verdict: str
    
    # BOOLEAN FLAGS
    is_shortlisted: bool
    trigger_interview: bool
    has_minimum_qualifications: bool
    has_relevant_experience: bool
    


        
        
        
    
        
    
    
