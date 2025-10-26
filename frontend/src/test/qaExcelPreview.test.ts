import { transformToQAExcelData, getQAStatistics, validateQAData } from '../utils/qaDataProcessor';
import { HierarchyData } from '../types/api';

// Test data
const testData: HierarchyData[] = [
  {
    section: "Introduction",
    subsection: "Overview",
    subsubsection: "",
    subsubsubsection: "",
    content: "Industrial automation systems use programmable logic controllers (PLCs) to control manufacturing processes.",
    question: "What type of controllers are commonly used in industrial automation systems to control manufacturing processes?",
    question_generated: true
  },
  {
    section: "Safety Systems",
    subsection: "Emergency Stops",
    subsubsection: "Types",
    subsubsubsection: "",
    content: "Emergency stop buttons must be easily accessible and clearly marked with red color according to safety standards.",
    question: "What are the requirements for emergency stop buttons in industrial safety systems?",
    question_generated: true
  },
  {
    section: "Sensors",
    subsection: "Types",
    subsubsection: "",
    subsubsubsection: "",
    content: "Proximity sensors detect the presence of objects without physical contact.",
    question: undefined, // No question generated
    question_generated: false
  },
  {
    section: "Control Systems",
    subsection: "SCADA",
    subsubsection: "Architecture",
    subsubsubsection: "Components",
    content: "SCADA systems consist of RTUs, PLCs, communication networks, and HMI interfaces for monitoring and control.",
    question: "What are the main components of a SCADA system architecture?",
    question_generated: true
  }
];

// Test transformToQAExcelData function
console.log('🧪 Testing transformToQAExcelData...');
const qaExcelData = transformToQAExcelData(testData);
console.log(`✅ Transformed ${testData.length} items to ${qaExcelData.length} QA pairs`);
console.log('📊 QA Excel Data:', qaExcelData);

// Test createHierarchicalResponse function
console.log('\n🧪 Testing createHierarchicalResponse...');
const testItem = testData[1]; // Safety Systems item
const hierarchicalResponse = createHierarchicalResponse(testItem);
console.log('✅ Hierarchical Response:');
console.log(hierarchicalResponse);

// Test getQAStatistics function
console.log('\n🧪 Testing getQAStatistics...');
const stats = getQAStatistics(testData);
console.log('✅ QA Statistics:', stats);

// Test validateQAData function
console.log('\n🧪 Testing validateQAData...');
const validation = validateQAData(testData);
console.log('✅ Validation Result:', validation);

// Test with empty data
console.log('\n🧪 Testing with empty data...');
const emptyValidation = validateQAData([]);
console.log('✅ Empty Data Validation:', emptyValidation);

// Test with invalid data
console.log('\n🧪 Testing with invalid data...');
const invalidData: HierarchyData[] = [
  {
    section: "",
    subsection: "",
    subsubsection: "",
    subsubsubsection: "",
    content: "",
    question: "",
    question_generated: true
  }
];
const invalidValidation = validateQAData(invalidData);
console.log('✅ Invalid Data Validation:', invalidValidation);

console.log('\n🎉 All tests completed!');

// Export test results for verification
export const testResults = {
  qaExcelData,
  hierarchicalResponse,
  stats,
  validation,
  emptyValidation,
  invalidValidation
};
