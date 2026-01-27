import fs from 'node:fs';

const filePath = 'c:/Users/Shaun/Downloads/Veltro/Veltro/attached_assets/UK Commercial Lenders.csv';

try {
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`Read ${content.length} bytes.`);

    // Replace Clearbit URLs with empty string
    // Matches https://logo.clearbit.com/... until a comma or quote or newline
    const newContent = content.replace(/https:\/\/logo\.clearbit\.com\/[^,"\r\n]*/g, '');

    fs.writeFileSync(filePath, newContent);
    console.log('Successfully removed Clearbit URLs.');

} catch (err) {
    console.error('Error cleaning CSV:', err);
    process.exit(1);
}
