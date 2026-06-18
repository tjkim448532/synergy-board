const fs = require('fs');
const files = [
  'src/components/RevenuePrediction.jsx',
  'src/components/NewBusinessTraining.jsx',
  'src/components/AdvancedAnalytics.jsx',
  'src/components/Settings.jsx',
  'src/components/MonthlyDataForm.jsx',
  'src/components/LogicGuide.jsx'
];
files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;
    content = content.replace(/whiteSpace:\s*['"]nowrap['"]/g, "whiteSpace: 'normal', wordBreak: 'keep-all', overflowWrap: 'anywhere'");
    if (content !== original) {
      fs.writeFileSync(file, content);
      console.log('Fixed nowrap in ' + file);
    }
  }
});

