import os
import uvicorn
from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3000"))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
