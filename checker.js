import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';

class UniformityChecker {
  constructor(projectPath, rules) {
    this.projectPath = projectPath;
    this.rules = rules;
    this.results = {
      structure: [],
      patterns: [],
      totalChecks: 0,
      passedChecks: 0
    };
  }

  // ============================================
  // 1. CHECK FOLDER/FILE STRUCTURE
  // ============================================
  checkStructure(section) {
    console.log(chalk.bold.cyan(`\n📁 Checking ${section} Structure...\n`));
    
    const sectionRules = this.rules[section];
    if (!sectionRules) return;

    const basePath = section === 'frontend' 
      ? path.join(this.projectPath, 'frontend')
      : path.join(this.projectPath, 'backend');

    // Check folders
    sectionRules.structure.required_folders?.forEach(folder => {
      const fullPath = path.join(basePath, folder);
      const exists = fs.existsSync(fullPath);
      
      this.results.structure.push({
        type: 'folder',
        path: folder,
        exists,
        section
      });
      
      this.results.totalChecks++;
      if (exists) this.results.passedChecks++;

      const icon = exists ? '✅' : '❌';
      const color = exists ? chalk.green : chalk.red;
      console.log(color(`${icon} ${folder}`));
    });

    // Check files
    sectionRules.structure.required_files?.forEach(file => {
      const fullPath = path.join(basePath, file);
      const exists = fs.existsSync(fullPath);
      
      this.results.structure.push({
        type: 'file',
        path: file,
        exists,
        section
      });
      
      this.results.totalChecks++;
      if (exists) this.results.passedChecks++;

      const icon = exists ? '✅' : '❌';
      const color = exists ? chalk.green : chalk.red;
      console.log(color(`${icon} ${file}`));
    });
  }

  // ============================================
  // 2. CHECK CODE PATTERNS
  // ============================================
  checkPatterns(section) {
    console.log(chalk.bold.cyan(`\n🔍 Checking ${section} Code Patterns...\n`));
    
    const sectionRules = this.rules[section];
    if (!sectionRules?.patterns) return;

    const basePath = section === 'frontend' 
      ? path.join(this.projectPath, 'frontend')
      : path.join(this.projectPath, 'backend');

    // Check API service patterns
    if (sectionRules.patterns.api_service) {
      this.checkFilePatterns(
        basePath,
        sectionRules.patterns.api_service,
        'API Service'
      );
    }

    // Check context patterns
    if (sectionRules.patterns.contexts) {
      this.checkContextPatterns(basePath, sectionRules.patterns.contexts);
    }
  }

  checkFilePatterns(basePath, rules, label) {
    const filePath = path.join(basePath, rules.file);
    
    if (!fs.existsSync(filePath)) {
      console.log(chalk.red(`❌ ${label}: File not found`));
      this.results.totalChecks++;
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const issues = [];

    // Check must_include patterns
    rules.must_include?.forEach(pattern => {
      this.results.totalChecks++;
      if (content.includes(pattern)) {
        this.results.passedChecks++;
        console.log(chalk.green(`✅ ${label}: Has "${pattern}"`));
      } else {
        issues.push(`Missing: ${pattern}`);
        console.log(chalk.red(`❌ ${label}: Missing "${pattern}"`));
      }
    });

    // Check cannot_include patterns
    rules.cannot_include?.forEach(pattern => {
      this.results.totalChecks++;
      if (!content.includes(pattern)) {
        this.results.passedChecks++;
        console.log(chalk.green(`✅ ${label}: Doesn't use "${pattern}"`));
      } else {
        issues.push(`Found forbidden: ${pattern}`);
        console.log(chalk.red(`❌ ${label}: Found forbidden "${pattern}"`));
      }
    });

    this.results.patterns.push({
      file: rules.file,
      label,
      issues
    });
  }

  checkContextPatterns(basePath, rules) {
    const pattern = path.join(basePath, rules.pattern.replace('*', '**/*'));
    const contextFiles = glob.sync(pattern);

    if (contextFiles.length === 0) {
      console.log(chalk.yellow(`⚠️  No context files found`));
      return;
    }

    contextFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const fileName = path.basename(file);
      const issues = [];

      rules.must_include?.forEach(pattern => {
        this.results.totalChecks++;
        if (content.includes(pattern)) {
          this.results.passedChecks++;
          console.log(chalk.green(`✅ ${fileName}: Has "${pattern}"`));
        } else {
          issues.push(`Missing: ${pattern}`);
          console.log(chalk.red(`❌ ${fileName}: Missing "${pattern}"`));
        }
      });

      this.results.patterns.push({
        file: path.relative(basePath, file),
        label: 'Context',
        issues
      });
    });
  }

  // ============================================
  // 3. GENERATE MOSAIC VISUALIZATION
  // ============================================
  generateMosaic() {
    const percentage = Math.round(
      (this.results.passedChecks / this.results.totalChecks) * 100
    );

    console.log(chalk.bold('\n' + '='.repeat(50)));
    console.log(chalk.bold.cyan(`📊 PROJECT UNIFORMITY: ${percentage}%`));
    console.log(chalk.bold('='.repeat(50) + '\n'));

    // Create visual blocks
    const totalBlocks = this.results.totalChecks;
    const passedBlocks = this.results.passedChecks;
    
    let mosaic = '';
    for (let i = 0; i < totalBlocks; i++) {
      if (i < passedBlocks) {
        mosaic += chalk.green('█');
      } else {
        mosaic += chalk.red('█');
      }
      
      // Line break every 20 blocks
      if ((i + 1) % 20 === 0) {
        mosaic += '\n';
      }
    }

    console.log(mosaic);
    console.log('\n' + chalk.bold('Summary:'));
    console.log(chalk.green(`✅ Passed: ${passedBlocks}/${totalBlocks}`));
    console.log(chalk.red(`❌ Failed: ${totalBlocks - passedBlocks}/${totalBlocks}`));

    // Color-coded result
    if (percentage >= 90) {
      console.log(chalk.bold.green('\n🎉 EXCELLENT! Project is highly uniform.\n'));
    } else if (percentage >= 70) {
      console.log(chalk.bold.yellow('\n⚠️  GOOD. Some improvements needed.\n'));
    } else {
      console.log(chalk.bold.red('\n🚨 NEEDS WORK. Many uniformity issues.\n'));
    }

    return percentage;
  }

  // ============================================
  // 4. SHOW ACTIONABLE ISSUES
  // ============================================
  showIssues() {
    console.log(chalk.bold.red('\n🔧 Issues to Fix:\n'));

    // Structure issues
    const missingStructure = this.results.structure.filter(s => !s.exists);
    if (missingStructure.length > 0) {
      console.log(chalk.bold('Missing Files/Folders:'));
      missingStructure.forEach(item => {
        console.log(chalk.red(`  • ${item.path}`));
      });
      console.log('');
    }

    // Pattern issues
    const patternsWithIssues = this.results.patterns.filter(p => p.issues.length > 0);
    if (patternsWithIssues.length > 0) {
      console.log(chalk.bold('Code Pattern Issues:'));
      patternsWithIssues.forEach(pattern => {
        console.log(chalk.yellow(`  ${pattern.file}:`));
        pattern.issues.forEach(issue => {
          console.log(chalk.red(`    - ${issue}`));
        });
      });
    }
  }

  // ============================================
  // 5. RUN ALL CHECKS
  // ============================================
  run() {
    console.log(chalk.bold.magenta(`\n${'='.repeat(50)}`));
    console.log(chalk.bold.magenta(`🔍 UNIFORMITY CHECKER`));
    console.log(chalk.bold.magenta(`${'='.repeat(50)}\n`));

    // Check frontend
    this.checkStructure('frontend');
    this.checkPatterns('frontend');

    // Check backend
    this.checkStructure('backend');
    this.checkPatterns('backend');

    // Generate mosaic
    const score = this.generateMosaic();

    // Show issues
    if (score < 100) {
      this.showIssues();
    }

    return score;
  }
}

// ============================================
// MAIN EXECUTION
// ============================================
const projectPath = process.argv[2] || process.cwd();
const rulesPath = path.join(import.meta.dirname, 'rules.json');

console.log(chalk.cyan(`📂 Checking project: ${projectPath}`));
console.log(chalk.cyan(`📋 Using rules: ${rulesPath}\n`));

const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
const checker = new UniformityChecker(projectPath, rules);
const score = checker.run();

process.exit(score === 100 ? 0 : 1);