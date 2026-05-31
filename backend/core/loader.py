from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

class CvLoader:
    def __init__(self,data_path:str="..data/pdf"):
        self.data_path=data_path
        self.loader=DirectoryLoader(
            self.data_path,
            glob="**/*.pdf",
            loader_cls=PyPDFLoader,
            show_progress=False
        )
    def load(self):
        print(f"Loading documents from {self.data_path}...")
        try:
            documents=self.loader.load()
            print(f"Loaded {len(documents)} documents.")
            return documents
        except Exception as e:
            print(f"Error loading documents: {e}")
            return []
        