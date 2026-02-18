---
description: Lead Finder Agent Setup and Usage
---

This workflow guides you through setting up and using the Lead Finder Agent.

1.  **Navigate to the Lead Agent directory**
    ```powershell
    cd "c:\Veltro\server\Lead Agent"
    ```

2.  **Install Dependencies**
    ```powershell
    pip install -r requirements.txt
    playwright install chromium
    ```

3.  **Configure Environment**
    Ensure `.env` exists and has your `GEMINI_API_KEY`.
    
    If not, create it:
    ```powershell
    copy .env.example .env
    notepad .env
    ```

4.  **Initialize Database**
    ```powershell
    python -m src.cli init
    ```

5.  **Run a Test Search (CLI)**
    ```powershell
    python -m src.cli search "commercial finance brokers in Leeds" --max-results 5
    ```

6.  **Run the Agent**
    ```powershell
    python -m src.cli agent "Find finance brokers in Manchester, minimum 4 stars"
    ```

7.  **Check Status**
    ```powershell
    python -m src.cli status
    ```

8.  **Export Leads**
    ```powershell
    python -m src.cli export --output leeds_brokers.csv
    ```
