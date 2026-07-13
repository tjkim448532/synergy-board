const fs = require('fs');
const file = 'src/components/ManagementStrategy.jsx';
let content = fs.readFileSync(file, 'utf8');

const importStr = `
import BookingPaceChart from './analytics/BookingPaceChart';
import WeatherThresholdWidget from './analytics/WeatherThresholdWidget';
`;

if(!content.includes('BookingPaceChart')) {
  content = content.replace('import { PieChart as RechartsPieChart', importStr + 'import { PieChart as RechartsPieChart');
}

const injectionStr = `
<div style={{display: 'flex', flexWrap: 'wrap', gap: '24px', marginTop: '32px'}}>
  <div style={{flex: '1 1 600px'}}>
    <BookingPaceChart />
  </div>
  <div style={{flex: '0 0 380px', display: 'flex', justifyContent: 'center'}}>
    <WeatherThresholdWidget />
  </div>
</div>
`;

const targetLoc = '</div>\n    </div>\n\n  </div>\n  );\n}';

if(!content.includes('<BookingPaceChart />')) {
  // Let's replace the last closing tags
  content = content.replace(/<\/div>\s*<\/div>\s*<\/div>\s*\);\s*}\s*$/, '</div>\n    </div>\n' + injectionStr + '\n  </div>\n  );\n}');
}

fs.writeFileSync(file, content);
console.log('Patched ManagementStrategy.jsx');
