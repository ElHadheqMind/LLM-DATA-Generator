// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
}

// Health Check Response
export interface HealthCheckResponse extends ApiResponse {
  status: string;
  version: string;
}

// Hierarchy Data Structure
export interface HierarchyData {
  document_name?: string; // Document name from preprocessing
  section: string;
  subsection: string;
  subsubsection: string;
  subsubsubsection: string;
  content: string;
  question?: string;
  answer?: string;
  questions?: string[];
  question_generated?: boolean;
  source_document?: string; // Document name for multi-document processing
}

// Q&A Excel Data Structure
export interface QAExcelData {
  documentName?: string; // Document name for multi-document exports
  question: string;
  answer: string;
  fullContent: string; // Full concatenated hierarchical context
  section: string;
  subsection: string;
  content: string;
  hasSection: boolean;
  hasSubsection: boolean;
  hasContent: boolean;
}

// Question Generation State
export interface QuestionGenerationState {
  serviceAvailable: boolean;
  isGenerating: boolean;
  progress: number;
  currentItem: number;
  totalItems: number;
  successCount: number;
  errorCount: number;
  provider: string;
  model?: string;
  lastError?: string;
  error?: string | null;
}

// PDF Processing Response
export interface ProcessPdfResponse extends ApiResponse {
  data: HierarchyData[];
  filename: string;
  total_rows: number;
  clean_applied?: boolean;
}

// Excel Download Response
export interface ExcelDownloadResponse extends ApiResponse {
  file_data: string; // base64 encoded
  filename: string;
}

// Excel Download Request
export interface ExcelDownloadRequest {
  data: HierarchyData[];
  filename: string;
  multiSheet?: boolean;
  documents?: { name: string; data: HierarchyData[] }[];
}

// Model Information
export interface ModelInfo {
  name: string;
  display_name: string;
  description?: string;
  max_tokens?: number;
  supports_streaming?: boolean;
  cost_per_token?: number;
}

// Question Generation Mode
export type GenerationMode = 'qa_pair' | 'question_only';

// Question Generation Request
export interface QuestionGenerationRequest {
  data: HierarchyData[];
  provider?: string;
  model: string; // REQUIRED: Model must be selected
  disable_fallback?: boolean;
  system_prompt: string; // REQUIRED: System prompt must be configured
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  generation_mode?: GenerationMode; // Mode: 'qa_pair' (default) or 'question_only'
}

// Question Generation Response
export interface QuestionGenerationResponse extends ApiResponse {
  data: HierarchyData[];
  total_items: number;
  successful_generations: number;
  provider_used: string;
  failed_provider?: string;
  provider_display_name?: string;
  disable_fallback?: boolean;
}

// Q&A Excel Download Request
export interface QAExcelDownloadRequest {
  data: HierarchyData[];
  filename: string;
}

// Q&A Excel Download Response
export interface QAExcelDownloadResponse extends ApiResponse {
  file_data: string; // base64 encoded
  filename: string;
  total_qa_pairs: number;
  document_count: number;
  is_multi_document: boolean;
  documents: string[]; // List of document names for multi-document exports
}



// Upload Progress
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// Document Types
export interface DocumentInfo {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
  processedData?: HierarchyData[];
  error?: string;
  uploadedAt: Date;
  processedAt?: Date;

}

// Application State Types
export interface AppState {
  isLoading: boolean;
  isProcessing: boolean;
  error: string | null;
  documents: DocumentInfo[];
  activeDocumentId: string | null;
  batchProcessing: {
    isActive: boolean;
    currentIndex: number;
    totalCount: number;
  };
  cleanOutput: boolean;
  questionGeneration: QuestionGenerationState;
}

// File Upload Types
export interface FileUploadState {
  files: File[];
  isUploading: boolean;
  progress: number;
  error: string | null;
}

// Batch Processing Types
export interface BatchProcessingOptions {
  processAll: boolean;
  selectedDocumentIds: string[];
  stopOnError: boolean;
}

// Batch Export Types
export interface BatchExportOptions {
  format: 'excel' | 'csv' | 'json';
  includeQuestions: boolean;
  separateSheets: boolean;
  filename?: string;
}

// PDF Viewer Types
export interface PDFViewerState {
  isOpen: boolean;
  documentId: string | null;
  currentPage: number;
  totalPages: number;
  scale: number;
}







// Dataset Export Types
export interface DatasetExportOptions {
  format: 'json' | 'csv';
  includeHierarchy: boolean;

  filename?: string;
}

export interface DatasetExportRequest {
  data: HierarchyData[];
  options: DatasetExportOptions;
}

export interface DatasetExportResponse extends ApiResponse {
  file_data: string; // base64 encoded
  filename: string;
  format: string;
}


