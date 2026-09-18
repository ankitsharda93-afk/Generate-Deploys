const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument();
doc.pipe(fs.createWriteStream('d:\\Cloudflares\\apps\\web\\public\\sample-business-profile.pdf'));

doc.fontSize(25)
   .text('Sample Business Profile', 100, 100);

doc.fontSize(15)
   .text('This is a sample document for Generate & Deploy.', 100, 150);

doc.fontSize(12)
   .text('Company Name: Tech Innovators Inc.', 100, 200)
   .text('Industry: Software Development', 100, 220)
   .text('Description: We build scalable, enterprise-grade deployment engines for modern workflows.', 100, 240);

doc.end();
console.log('PDF generated successfully');
