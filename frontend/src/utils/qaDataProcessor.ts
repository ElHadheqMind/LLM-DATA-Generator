import { HierarchyData, QAExcelData } from '../types/api';

export interface QAStatistics {
  totalQuestions: number;
  questionsWithSections: number;
  questionsWithoutSections: number;
  averageQuestionLength: number;
  averageAnswerLength: number;
  sectionsCount: number;
  subsectionsCount: number;
  itemsWithQuestions: number;
  questionGenerationRate: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Transform hierarchy data to Q&A Excel format
 */
export function transformToQAExcelData(data: HierarchyData[]): QAExcelData[] {
  const qaData: QAExcelData[] = [];

  data.forEach((item) => {
    // Handle both single question and multiple questions
    const questions = item.questions || (item.question ? [item.question] : []);

    if (questions && questions.length > 0) {
      questions.forEach((question) => {
        // Build hierarchical context
        const contextParts: string[] = [];
        
        if (item.section && item.section.trim()) {
          contextParts.push(`Section: ${item.section.trim()}`);
        }
        
        if (item.subsection && item.subsection.trim()) {
          contextParts.push(`Subsection: ${item.subsection.trim()}`);
        }
        
        if (item.content && item.content.trim()) {
          contextParts.push(`Content: ${item.content.trim()}`);
        }

        const hierarchicalContext = contextParts.join(' | ');

        // Use only the parsed answer from JSON response, leave empty if not available
        const answer = item.answer && item.answer.trim()
          ? item.answer.trim()
          : '';  // Empty answer if not parsed from JSON

        qaData.push({
          documentName: (item as any).source_document || undefined, // Add document name if available
          question: question.trim(),
          answer: answer,
          fullContent: hierarchicalContext || 'No context available', // Full concatenated content
          section: item.section || '',
          subsection: item.subsection || '',
          content: item.content || '',
          hasSection: !!(item.section && item.section.trim()),
          hasSubsection: !!(item.subsection && item.subsection.trim()),
          hasContent: !!(item.content && item.content.trim())
        });
      });
    }
  });

  return qaData;
}

/**
 * Get statistics about Q&A data
 */
export function getQAStatistics(data: HierarchyData[]): QAStatistics {
  const qaData = transformToQAExcelData(data);
  
  const totalQuestions = qaData.length;
  const questionsWithSections = qaData.filter(item => item.hasSection).length;
  const questionsWithoutSections = totalQuestions - questionsWithSections;
  
  const questionLengths = qaData.map(item => item.question.length);
  const answerLengths = qaData.map(item => item.answer.length);
  
  const averageQuestionLength = questionLengths.length > 0 
    ? questionLengths.reduce((sum, len) => sum + len, 0) / questionLengths.length 
    : 0;
    
  const averageAnswerLength = answerLengths.length > 0 
    ? answerLengths.reduce((sum, len) => sum + len, 0) / answerLengths.length 
    : 0;

  const uniqueSections = new Set(data.map(item => item.section).filter(Boolean));
  const uniqueSubsections = new Set(data.map(item => item.subsection).filter(Boolean));

  const itemsWithQuestions = data.filter(item => {
    const questions = item.questions || (item.question ? [item.question] : []);
    return questions.length > 0;
  }).length;

  const questionGenerationRate = data.length > 0 ? (itemsWithQuestions / data.length) * 100 : 0;

  return {
    totalQuestions,
    questionsWithSections,
    questionsWithoutSections,
    averageQuestionLength: Math.round(averageQuestionLength),
    averageAnswerLength: Math.round(averageAnswerLength),
    sectionsCount: uniqueSections.size,
    subsectionsCount: uniqueSubsections.size,
    itemsWithQuestions,
    questionGenerationRate
  };
}

/**
 * Validate Q&A data for common issues
 */
export function validateQAData(data: HierarchyData[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!data || data.length === 0) {
    errors.push('No data provided for validation');
    return { isValid: false, errors, warnings };
  }

  const qaData = transformToQAExcelData(data);
  
  if (qaData.length === 0) {
    errors.push('No questions found in the data');
    return { isValid: false, errors, warnings };
  }

  // Check for empty questions
  const emptyQuestions = qaData.filter(item => !item.question.trim()).length;
  if (emptyQuestions > 0) {
    errors.push(`Found ${emptyQuestions} empty questions`);
  }

  // Check for very short questions
  const shortQuestions = qaData.filter(item => item.question.trim().length < 10).length;
  if (shortQuestions > 0) {
    warnings.push(`Found ${shortQuestions} very short questions (less than 10 characters)`);
  }

  // Check for questions without context
  const noContextQuestions = qaData.filter(item => 
    !item.hasSection && !item.hasSubsection && !item.hasContent
  ).length;
  if (noContextQuestions > 0) {
    warnings.push(`Found ${noContextQuestions} questions without any context (section, subsection, or content)`);
  }

  // Check for duplicate questions
  const questionTexts = qaData.map(item => item.question.toLowerCase().trim());
  const uniqueQuestions = new Set(questionTexts);
  if (questionTexts.length !== uniqueQuestions.size) {
    const duplicates = questionTexts.length - uniqueQuestions.size;
    warnings.push(`Found ${duplicates} duplicate questions`);
  }

  // Check for very long questions
  const longQuestions = qaData.filter(item => item.question.length > 500).length;
  if (longQuestions > 0) {
    warnings.push(`Found ${longQuestions} very long questions (over 500 characters)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Filter Q&A data to only include items with sections
 */
export function filterQADataWithSections(data: HierarchyData[]): HierarchyData[] {
  return data.filter(item => item.section && item.section.trim());
}

/**
 * Clean Q&A data by removing items without proper context
 */
export function cleanQAData(data: HierarchyData[], options: {
  requireSection?: boolean;
  requireSubsection?: boolean;
  requireContent?: boolean;
  minQuestionLength?: number;
} = {}): HierarchyData[] {
  const {
    requireSection = true,
    requireSubsection = false,
    requireContent = false,
    minQuestionLength = 5
  } = options;

  return data.filter(item => {
    // Check section requirement
    if (requireSection && (!item.section || !item.section.trim())) {
      return false;
    }

    // Check subsection requirement
    if (requireSubsection && (!item.subsection || !item.subsection.trim())) {
      return false;
    }

    // Check content requirement
    if (requireContent && (!item.content || !item.content.trim())) {
      return false;
    }

    // Check questions
    const questions = item.questions || (item.question ? [item.question] : []);
    if (!questions || questions.length === 0) {
      return false;
    }

    // Filter questions by length
    const validQuestions = questions.filter(q =>
      q && q.trim().length >= minQuestionLength
    );

    if (validQuestions.length === 0) {
      return false;
    }

    // Update item with filtered questions
    if (item.questions) {
      item.questions = validQuestions;
    } else if (validQuestions.length > 0) {
      item.question = validQuestions[0];
    }
    return true;
  });
}

/**
 * Export Q&A data to CSV format
 */
export function exportToCSV(data: HierarchyData[]): string {
  const qaData = transformToQAExcelData(data);

  // Check if this is multi-document data
  const hasMultipleDocuments = qaData.some(item => item.documentName);

  const headers = hasMultipleDocuments
    ? ['Document Name', 'Question', 'Answer', 'Context']
    : ['Question', 'Answer', 'Full Content'];
  const csvRows = [headers.join(',')];

  qaData.forEach(item => {
    const row = hasMultipleDocuments
      ? [
          `"${(item.documentName || 'Unknown Document').replace(/"/g, '""')}"`,
          `"${item.question.replace(/"/g, '""')}"`,
          `"${item.answer.replace(/"/g, '""')}"`,
          `"${item.fullContent.replace(/"/g, '""')}"`
        ]
      : [
          `"${item.question.replace(/"/g, '""')}"`,
          `"${item.answer.replace(/"/g, '""')}"`,
          `"${item.fullContent.replace(/"/g, '""')}"`
        ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

/**
 * Group Q&A data by section
 */
export function groupQADataBySection(data: HierarchyData[]): Record<string, QAExcelData[]> {
  const qaData = transformToQAExcelData(data);
  const grouped: Record<string, QAExcelData[]> = {};
  
  qaData.forEach(item => {
    const section = item.section || 'No Section';
    if (!grouped[section]) {
      grouped[section] = [];
    }
    grouped[section].push(item);
  });
  
  return grouped;
}
