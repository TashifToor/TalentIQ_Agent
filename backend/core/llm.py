from dotenv import load_dotenv
from langchain_groq import ChatGroq
import os

load_dotenv()

llm=ChatGroq(
    model='llama-3.3-70b-versatile',
    api_key=os.getenv('GROQ_API_KEY'),
    temperature=0.1,
    timeout=40,       # hard cap on a single Groq call — pairs with the
    # asyncio timeout wrapper in routes/screen.py
    max_retries=1,    # don't silently retry-loop on a flaky call and blow past the timeout budget
)