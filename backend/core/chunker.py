from langchain.text_splitter import RecursiveCharacterTextSplitter

class TextChunker:
    def __init__(self, chunk_size=800, chunk_overlap=100):
        self.splitter=RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ".", " "]
        )
    
    def split_documents(self,documents):
        print(f"splitting documents into chunks")
        chunks=self.splitter.split_documents(documents)
        
        for i,chunk in enumerate(chunks):
            chunk.metadata["chunk_id"]=i
        
        print(f"Created {len(chunks)} total text chunk")
        return chunks
    