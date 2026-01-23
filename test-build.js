// Quick test to verify build works
const { execSync } = require('child_process');

try {
    console.log('Running TypeScript compiler...');
    const output = execSync('npx tsc -noEmit -skipLibCheck', { 
        encoding: 'utf-8',
        cwd: __dirname
    });
    console.log('✓ TypeScript compilation successful!');
    console.log(output);
} catch (error) {
    console.error('✗ TypeScript compilation failed:');
    console.error(error.stdout || error.message);
    process.exit(1);
}
