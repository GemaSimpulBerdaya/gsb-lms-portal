const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir('./src', function(filePath) {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // 1. Rename category to fase in Student context
    // This includes student.category, formData.category (in StudentModal), etc.
    if (filePath.includes('StudentModal') || filePath.includes('Raport') || filePath.includes('AnakDidik') || filePath.includes('reportAggregator') || filePath.includes('pdf')) {
        content = content.replace(/\bcategory\b/g, 'fase');
        content = content.replace(/\bcategories\b/g, 'fases');
    }

    // 2. Rename category to programType and level to fase in Module context
    if (filePath.includes('ModuleTable') || filePath.includes('ModuleModal') || filePath.includes('modules') || filePath.includes('seed')) {
        // Only replace category -> programType if it's not already related to subCategory
        // This regex replaces category when it's standalone (not subCategory)
        content = content.replace(/(?<!sub)category/g, 'programType');
        content = content.replace(/(?<!sub)Category/g, 'ProgramType');
        content = content.replace(/\bcategory:/g, 'programType:');
        
        // Rename subCategory to subCategoryId (string to string, not ideal but let's just rename the field)
        content = content.replace(/\bsubCategory\b/g, 'subCategoryId');
        content = content.replace(/\bsubCategories\b/g, 'subCategories'); // Keep array name? Actually let's just leave subCategories alone
        
        // Rename level to fase
        content = content.replace(/\blevel\b/g, 'fase');
        content = content.replace(/\blevels\b/g, 'fases');
    }

    // 3. Rename level to fase in Schedule, Report, Portfolio context
    if (filePath.includes('Schedule') || filePath.includes('Report') || filePath.includes('Portfolio') || filePath.includes('schedule')) {
        content = content.replace(/\blevel\b/g, 'fase');
        content = content.replace(/\blevels\b/g, 'fases');
    }

    // 4. Update specific API routes that deal with these
    if (filePath.includes('api')) {
        // If it's a student API
        if (filePath.includes('admin\\students') || filePath.includes('volunteer\\students')) {
            content = content.replace(/\bcategory\b/g, 'fase');
        }
    }

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
});

console.log("Refactoring complete.");
