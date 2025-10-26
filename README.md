# AgentExtractorV1

A powerful document data extraction application that transforms documents into synthetic LLM training data for fine-tuning. Combines intelligent document processing with AI-powered question generation to create high-quality datasets for machine learning models.

**Developed by ElHadheqMind**

---

## Overview

AgentExtractorV1 is a modern web application designed to convert documents into synthetic training data for LLM fine-tuning. It extracts hierarchical content from documents and generates AI-powered question-answer pairs, creating ready-to-use datasets for training and fine-tuning language models. Built with a React frontend and Flask backend, it provides a seamless experience for document processing and synthetic data generation.

---

## Features

### Document Processing
- **Multi-Format Support**: Process PDF documents with support for various document structures
- **Hierarchical Extraction**: Automatically detects and extracts section hierarchies (section → subsection → subsubsection → content)
- **Smart Section Detection**: Dual extraction strategy using PDF Table of Contents and regex pattern matching
- **Batch Processing**: Upload and process multiple documents simultaneously
- **Excel Export**: Export extracted data to formatted Excel files with multiple export options

### AI-Powered Synthetic Data Generation
- **Question-Answer Generation**: Transform document content into synthetic LLM training data
- **Fine-Tuning Ready**: Generate datasets optimized for LLM fine-tuning workflows
- **Multiple AI Providers**:
  - **Cloud APIs**: OpenAI (GPT-4, GPT-3.5-Turbo) and Google Gemini
  - **Open Source Models**: Ollama and LM Studio for local/private deployments
- **Customizable Prompts**: Configure system prompts and generation parameters
- **Real-time Progress**: Track generation progress with live updates
- **Flexible Export**: Export datasets in various formats compatible with fine-tuning pipelines

### Security & Privacy
- **Client-Side Storage**: API keys stored securely in browser localStorage
- **No Backend Persistence**: Credentials never stored on the server
- **Multi-User Support**: Multiple users can use the same deployment without authentication
- **Per-Request Authentication**: API keys passed per-request for complete isolation

### User Experience
- **Minimal UI**: Clean, distraction-free interface with instant feedback
- **Real-time Updates**: Live progress tracking for all operations
- **Error Handling**: Clear error messages and robust error recovery
- **Type Safety**: Full TypeScript implementation for reliability

---

## Installation

### Prerequisites
- **Python**: Version 3.8 or higher
- **Node.js**: Version 16 or higher
- **pip**: Python package manager
- **npm**: Node.js package manager

### Step 1: Clone the Repository
```bash
git clone <repository-url>
cd AgentExtractorV1
```

### Step 2: Backend Setup
```bash
# Install Python dependencies
pip install -r requirements.txt
```

### Step 3: Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install Node.js dependencies
npm install

# Return to root directory
cd ..
```

### Step 4: Configuration
No configuration files needed! API keys are managed through the application UI and stored securely in your browser.

---

## Usage

### Starting the Application

**Option 1: Manual Start**

Open two terminal windows:

**Terminal 1 - Backend:**
```bash
cd backend
python app.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Option 2: Quick Start (Windows)**
```bash
# Backend
cd backend
start-backend.bat

# Frontend (in another terminal)
cd frontend
npm run dev
```

### Accessing the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000

### Using the Application

1. **Configure AI Providers** (First Time Setup)
   - Click "AI Providers" button in the header
   - Choose your preferred AI provider:
     - **OpenAI**: Add your API key for GPT-4 or GPT-3.5-Turbo
     - **Google Gemini**: Add your API key for Gemini models
     - **Ollama**: Configure local endpoint for open source models
     - **LM Studio**: Configure local endpoint for open source models
   - Test the connection
   - Save settings (stored in browser only)

2. **Upload Documents**
   - Drag and drop PDF files or click to browse
   - Upload multiple documents at once
   - Rename or reorder documents as needed

3. **Process Documents**
   - Click "Process" on individual documents or "Process All"
   - View extracted hierarchical data in real-time
   - Review the structured content

4. **Generate Synthetic Training Data**
   - Select processed documents
   - Configure generation parameters (temperature, tokens, etc.)
   - Customize system prompts for your fine-tuning needs
   - Start generation and monitor progress
   - Review generated question-answer pairs

5. **Export Fine-Tuning Datasets**
   - Export extracted data to Excel
   - Export question-answer datasets for LLM fine-tuning
   - Choose from multiple export formats
   - Download files directly to your computer

---

## Technology Stack

### Backend
- **Flask**: Web framework with CORS support
- **PyMuPDF & PyPDF2**: PDF text extraction and TOC support
- **OpenPyXL**: Excel file generation
- **AI Provider SDKs**:
  - **OpenAI SDK**: GPT-4 and GPT-3.5-Turbo integration
  - **Google Generative AI**: Gemini model integration
  - **Ollama**: Open source model support via local API
  - **LM Studio**: Open source model support via local API
- **Pandas**: Data manipulation and processing

### Frontend
- **React 19**: Modern UI framework with TypeScript
- **Vite**: Fast development and build tool
- **Axios**: HTTP client for API communication
- **Lucide React**: Icon library
- **Tailwind CSS**: Utility-first styling

---

## AI Provider Support

AgentExtractorV1 supports multiple AI providers for maximum flexibility:

### Cloud-Based APIs
- **OpenAI**: GPT-4, GPT-3.5-Turbo (requires API key)
- **Google Gemini**: Gemini 1.5 Flash, Gemini 1.5 Pro (requires API key)

### Open Source Models (Local)
- **Ollama**: Run open source models locally (Llama, Mistral, etc.)
- **LM Studio**: Run open source models locally with a user-friendly interface

### API Key Management

AgentExtractorV1 uses a secure, client-side approach to API key management:

- **Browser Storage Only**: Keys stored in localStorage, never on the server
- **No Persistence**: Keys don't persist after page refresh (intentional security feature)
- **Per-Request Auth**: Keys passed with each request, no server-side storage
- **Multi-User Safe**: Each user's keys are completely isolated
- **Privacy First**: No backend files store credentials

**Note**: You'll need to re-enter your API keys after refreshing the page. This is a security feature to prevent unauthorized access.

**For Ollama/LM Studio**: Configure the local endpoint URL (e.g., http://localhost:11434 for Ollama) instead of API keys.

---

## Supported Document Formats

- **PDF** (.pdf): Full support with TOC extraction and regex pattern matching

---

## License

This project is licensed under the MIT License.

---

## Support

For issues, questions, or feature requests:
1. Check the application logs for detailed error messages
2. Verify your API keys are correctly configured
3. Ensure both backend and frontend services are running
4. Create an issue on the project repository

---

**© ElHadheqMind** - Professional Document Data Extraction Tool
