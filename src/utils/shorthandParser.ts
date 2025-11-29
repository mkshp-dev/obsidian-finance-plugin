// src/utils/shorthandParser.ts

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Interface representing a parsed BQL shorthand definition.
 */
export interface BQLShorthand {
    name: string;
    description: string;
    query: string;
}

/**
 * ShorthandParser
 *
 * Utility for parsing and managing BQL (Beancount Query Language) shorthands/shortcuts.
 * Allows users to define custom query aliases in a markdown file.
 */
export class ShorthandParser {
    /**
     * Parse BQL shortcuts from a markdown template file
     * @param {string} filePath Absolute path to the template file
     * @returns {Record<string, string>} Record of shorthand name to query string
     */
    static parseShorthandsFromFile(filePath: string): Record<string, string> {
        if (!filePath || !existsSync(filePath)) {
            return {}; // Return empty object instead of defaults
        }

        try {
            const content = readFileSync(filePath, 'utf-8');
            return this.parseShorthandsFromContent(content);
        } catch (error) {
            return {}; // Return empty object instead of defaults
        }
    }

    /**
     * Parse BQL shortcuts from markdown content
     * @param {string} content Markdown content containing shorthand definitions
     * @returns {Record<string, string>} Record of shorthand name to query string
     */
    static parseShorthandsFromContent(content: string): Record<string, string> {
        const shortcuts: Record<string, string> = {};
        
        // Pattern to match: ## SHORTCUT_NAME: Description followed by ```bql-shorthand...```
        const shorthandPattern = /^##\s+([A-Z_][A-Z0-9_]*)\s*:\s*([^\n]*)\n```bql-shorthand\n([\s\S]*?)\n```/gm;
        
        let match;
        while ((match = shorthandPattern.exec(content)) !== null) {
            const [, name, description, query] = match;
            const cleanQuery = query.trim();
            
            if (name && cleanQuery) {
                shortcuts[name] = cleanQuery;
            }
        }
        
        return shortcuts;
    }



    /**
     * Create a default template file if it doesn't exist
     * @param {string} filePath Path where to create the template file
     */
    static createDefaultTemplateFile(filePath: string): void {
        if (existsSync(filePath)) {
            return; // Don't overwrite existing file
        }

        const defaultContent = `# BQL Shortcuts Template

This file defines your custom BQL shortcuts for inline use. 

**Important**: ALL shortcuts must be defined in this file. There are no built-in defaults.

## How to use shortcuts
- In your notes, use \`bql-sh:SHORTCUT_NAME\` to insert live financial data
- Example: \`bql-sh:WORTH\` will show your total worth
- You can also use direct queries: \`bql:SELECT your_query_here\`

## Shortcut Format
Each shortcut is defined with this exact pattern:
\`\`\`
## SHORTCUT_NAME: Description
\`\`\`bql-shorthand
YOUR_BQL_QUERY_HERE
\`\`\`

---

## WORTH: Total worth across all accounts (change currency as needed)
\`\`\`bql-shorthand
SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets' and currency ~'USD'
\`\`\`

## ASSETS: Total assets
\`\`\`bql-shorthand
SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets' and currency ~'USD'
\`\`\`

## LIABILITIES: Total liabilities
\`\`\`bql-shorthand
SELECT convert(sum(position), 'USD') WHERE account ~ '^Liabilities' and currency ~'USD'
\`\`\`

## NETWORTH: Net worth (assets minus liabilities)
\`\`\`bql-shorthand
SELECT (SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets' and currency ~'USD') - (SELECT convert(sum(position), 'USD') WHERE account ~ '^Liabilities' and currency ~'USD')
\`\`\`

## CHECKING: Checking account balance
\`\`\`bql-shorthand
SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Checking' and currency ~'USD'
\`\`\`

## SAVINGS: Savings account balance
\`\`\`bql-shorthand
SELECT convert(sum(position), 'USD') WHERE account ~ '^Assets:Savings' and currency ~'USD'
\`\`\`

---

## Custom Shortcuts

Add your own shortcuts below using the same format. Remember to:
1. Use UPPERCASE names for shortcuts
2. Change USD to your preferred currency (INR, EUR, etc.)
3. Adjust account patterns to match your account structure

## MY_CUSTOM_SHORTCUT: Description of what this shortcut does
\`\`\`bql-shorthand
SELECT your_custom_query_here
\`\`\`
`;

        try {
            const fs = require('fs');
            const path = require('path');
            
            // Ensure directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(filePath, defaultContent, 'utf-8');
            console.log(`Created default BQL shortcuts template file: ${filePath}`);
        } catch (error) {
            console.error(`Error creating default template file: ${error}`);
        }
    }
}
